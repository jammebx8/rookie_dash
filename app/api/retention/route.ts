/**
 * /api/retention
 *
 * D1–D7 cohort retention + monthly retention.
 *
 * Cohort definition:
 *   - A "cohort" is all users who first appeared on a given date
 *     (first answer in user_activity OR account creation date from auth.users).
 *   - Dn retention = % of that cohort who had any activity on day N after
 *     their first day.
 *
 * We compute this for each of the last 30 cohort days so the table shows
 * how each day's new users retained over subsequent days.
 *
 * We also compute:
 *   - Rolling D1–D7: average across all cohorts that have enough history
 *   - Monthly retention: users active last month who came back this month
 */
import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserProfiles }            from "@/lib/getUserProfiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    // Pull 60 days of activity to give D30 cohorts a full 30-day observation window
    const sixtyDaysAgo = new Date(Date.now() - 59 * 86400000);
    sixtyDaysAgo.setHours(0, 0, 0, 0);

    const { data: actRows, error: actErr } = await sb
      .from("user_activity")
      .select("user_id, answered_at")
      .gte("answered_at", sixtyDaysAgo.toISOString())
      .not("user_id", "is", null)
      .limit(100000);

    if (actErr) throw new Error(actErr.message);

    const rows = actRows ?? [];

    // ── Build per-user activity-day set ──────────────────────────────────────
    // userDays[uid] = Set of ISO date strings when they were active
    const userDays = new Map<string, Set<string>>();
    rows.forEach((r) => {
      const uid = r.user_id as string;
      const day = (r.answered_at as string).slice(0, 10);
      if (!userDays.has(uid)) userDays.set(uid, new Set());
      userDays.get(uid)!.add(day);
    });

    // ── Determine each user's first-seen date (from activity) ─────────────────
    const firstSeen = new Map<string, string>(); // uid → YYYY-MM-DD
    userDays.forEach((days, uid) => {
      const sorted = [...days].sort();
      firstSeen.set(uid, sorted[0]);
    });

    // ── Build cohorts: cohortDay → Set<uid> ───────────────────────────────────
    const cohorts = new Map<string, Set<string>>();
    firstSeen.forEach((day, uid) => {
      if (!cohorts.has(day)) cohorts.set(day, new Set());
      cohorts.get(day)!.add(uid);
    });

    // ── D1–D7 retention per cohort (last 30 cohort days that have enough data)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // We only show cohorts that are at least 1 day old (so D1 is observable)
    const cohortTable: {
      cohortDate:   string;
      cohortLabel:  string;
      cohortSize:   number;
      dn:           (number | null)[];  // index 0 = D1, index 6 = D7
    }[] = [];

    for (let c = 29; c >= 0; c--) {
      const cohortDate = new Date(Date.now() - c * 86400000);
      cohortDate.setHours(0, 0, 0, 0);
      const cohortKey = cohortDate.toISOString().slice(0, 10);
      const cohort    = cohorts.get(cohortKey);
      if (!cohort || cohort.size === 0) continue;

      const dn: (number | null)[] = [];
      for (let n = 1; n <= 7; n++) {
        const targetDate = new Date(cohortDate.getTime() + n * 86400000);
        targetDate.setHours(0, 0, 0, 0);
        // If target day is in the future, mark as null (not yet observable)
        if (targetDate > today) {
          dn.push(null);
          continue;
        }
        const targetKey = targetDate.toISOString().slice(0, 10);
        const returned  = [...cohort].filter((uid) =>
          userDays.get(uid)?.has(targetKey)
        ).length;
        dn.push(Math.round((returned / cohort.size) * 100));
      }

      cohortTable.push({
        cohortDate:  cohortKey,
        cohortLabel: cohortDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        cohortSize:  cohort.size,
        dn,
      });
    }

    // ── Rolling average D1–D7 (across cohorts that have observable data) ──────
    const rollingDn: (number | null)[] = Array.from({ length: 7 }, (_, n) => {
      const observable = cohortTable.filter((row) => row.dn[n] !== null);
      if (observable.length === 0) return null;
      return Math.round(
        observable.reduce((s, row) => s + (row.dn[n] as number), 0) / observable.length
      );
    });

    // ── Monthly retention ─────────────────────────────────────────────────────
    // "This month" = current calendar month; "last month" = previous calendar month
    const now      = new Date();
    const thisMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    // Fetch last-month activity separately (outside our 60-day window for some months)
    const { data: lastMonthRows } = await sb
      .from("user_activity")
      .select("user_id")
      .gte("answered_at", lastMonthStart + "T00:00:00")
      .lte("answered_at", lastMonthEnd   + "T23:59:59")
      .not("user_id", "is", null)
      .limit(50000);

    const lastMonthSet = new Set(
      (lastMonthRows ?? []).map((r) => r.user_id as string).filter(Boolean)
    );

    const thisMonthSet = new Set<string>();
    rows.forEach((r) => {
      if ((r.answered_at as string).slice(0, 10) >= thisMonthStart) {
        if (r.user_id) thisMonthSet.add(r.user_id as string);
      }
    });

    const monthlyRetained   = [...lastMonthSet].filter((uid) => thisMonthSet.has(uid)).length;
    const monthlyRetention  = lastMonthSet.size > 0
      ? Math.round((monthlyRetained / lastMonthSet.size) * 100)
      : 0;

    // ── Top retained users: active on 5+ of the last 7 days ──────────────────
    const sevenDaysAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const highRetentionUids: string[] = [];
    userDays.forEach((days, uid) => {
      const recentDays = [...days].filter((d) => d >= sevenDaysAgoStr).length;
      if (recentDays >= 5) highRetentionUids.push(uid);
    });

    // Enrich top retained users with names
    const profileMap = await getUserProfiles(highRetentionUids.slice(0, 20));
    const topRetainedUsers = highRetentionUids.slice(0, 20).map((uid) => {
      const p    = profileMap.get(uid);
      const days = [...(userDays.get(uid) ?? [])].filter((d) => d >= sevenDaysAgoStr).length;
      return {
        userId:    uid,
        name:      p?.name      ?? uid.slice(0, 8),
        email:     p?.email     ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        activeDaysLast7: days,
      };
    }).sort((a, b) => b.activeDaysLast7 - a.activeDaysLast7);

    return Response.json({
      cohortTable,
      rollingDn,
      monthlyRetention,
      lastMonthActiveUsers:  lastMonthSet.size,
      thisMonthActiveUsers:  thisMonthSet.size,
      monthlyRetained,
      topRetainedUsers,
    });
  } catch (err) {
    console.error("[retention]", err);
    return Response.json({
      cohortTable: [], rollingDn: [], monthlyRetention: 0,
      lastMonthActiveUsers: 0, thisMonthActiveUsers: 0,
      monthlyRetained: 0, topRetainedUsers: [],
      error: String(err),
    }, { status: 200 });
  }
}

/**
 * /api/retention
 *
 * Supports:
 *   ?interval=daily | weekly | monthly (default: daily)
 *   ?segment=all | free | paid         (default: all)
 *
 * Returns:
 *   - cohortTable & rolling averages for chosen interval & segment
 *   - neverReturnedAfterUsing: drop-off after 1st product use
 *   - neverReturnedAfterSignup: drop-off after signup (0 activity or day-1 bounce)
 *   - repeatPlatformUsage: repeat days distribution
 *   - monthlyRetention & topRetainedUsers
 */
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserProfiles, UserProfile } from "@/lib/getUserProfiles";

export const dynamic = "force-dynamic";

function getWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getWeekStart(isoDate: string): Date {
  const d = new Date(isoDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function GET(req: NextRequest) {
  try {
    const sb = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const interval = (searchParams.get("interval") ?? "daily").toLowerCase(); // daily | weekly | monthly
    const segment = (searchParams.get("segment") ?? "all").toLowerCase();     // all | free | paid

    // ── 1. Fetch data in parallel ─────────────────────────────────────────────
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const [actRes, entRes, ordersRes, usersRes] = await Promise.all([
      sb
        .from("user_activity")
        .select("user_id, answered_at, chapter_title, subject_name")
        .gte("answered_at", ninetyDaysAgo.toISOString())
        .not("user_id", "is", null)
        .limit(100000),

      sb.from("entitlements").select("user_id, access_until"),
      sb.from("orders").select("user_id, status"),
      sb.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (actRes.error) throw new Error(actRes.error.message);

    const rawRows = actRes.data ?? [];
    const authUsers = usersRes.data?.users ?? [];

    // ── 2. Identify paid vs free users ───────────────────────────────────────
    const nowIso = new Date().toISOString();
    const paidUserIds = new Set<string>();
    (entRes.data ?? []).forEach((e) => {
      if ((e.access_until as string) > nowIso) paidUserIds.add(e.user_id as string);
    });
    (ordersRes.data ?? []).forEach((o) => {
      if (o.status === "paid") paidUserIds.add(o.user_id as string);
    });

    // Filter rows by segment
    const rows = rawRows.filter((r) => {
      const uid = r.user_id as string;
      if (segment === "paid") return paidUserIds.has(uid);
      if (segment === "free") return !paidUserIds.has(uid);
      return true;
    });

    // ── 3. Build per-user calendar activity ──────────────────────────────────
    const userDays = new Map<string, Set<string>>();
    const userWeeks = new Map<string, Set<string>>();
    const userMonths = new Map<string, Set<string>>();
    const userQuestionsCount = new Map<string, number>();
    const userLastActivity = new Map<string, string>();
    const userFirstChapter = new Map<string, string>();

    rows.forEach((r) => {
      const uid = r.user_id as string;
      const ts = r.answered_at as string;
      const day = ts.slice(0, 10);
      const week = getWeekKey(ts);
      const month = ts.slice(0, 7);

      if (!userDays.has(uid)) userDays.set(uid, new Set());
      userDays.get(uid)!.add(day);

      if (!userWeeks.has(uid)) userWeeks.set(uid, new Set());
      userWeeks.get(uid)!.add(week);

      if (!userMonths.has(uid)) userMonths.set(uid, new Set());
      userMonths.get(uid)!.add(month);

      userQuestionsCount.set(uid, (userQuestionsCount.get(uid) ?? 0) + 1);

      if (!userLastActivity.has(uid) || ts > userLastActivity.get(uid)!) {
        userLastActivity.set(uid, ts);
      }
      if (!userFirstChapter.has(uid) && r.chapter_title) {
        userFirstChapter.set(uid, `${r.subject_name ?? ""} · ${r.chapter_title}`);
      }
    });

    // ── 4. Never returned after using product ────────────────────────────────
    const todayStr = new Date().toISOString().slice(0, 10);
    const dropoffProductUserIds: string[] = [];
    let neverReturnedAfterUsingCount = 0;

    userDays.forEach((days, uid) => {
      if (days.size === 1) {
        const onlyDay = [...days][0];
        if (onlyDay < todayStr) {
          neverReturnedAfterUsingCount++;
          dropoffProductUserIds.push(uid);
        }
      }
    });

    const totalProductUsers = userDays.size;
    const returnedProductUsers = Math.max(0, totalProductUsers - neverReturnedAfterUsingCount);

    // ── 5. Never returned after sign up ──────────────────────────────────────
    let neverReturnedAfterSignupCount = 0;
    let zeroActivityAfterSignupCount = 0;
    let day1OnlyAfterSignupCount = 0;
    const dropoffSignupUserIds: string[] = [];

    // Filter authUsers by segment if needed
    const relevantAuthUsers = authUsers.filter((u) => {
      if (segment === "paid") return paidUserIds.has(u.id);
      if (segment === "free") return !paidUserIds.has(u.id);
      return true;
    });

    relevantAuthUsers.forEach((u) => {
      const signupDay = u.created_at.slice(0, 10);
      if (signupDay >= todayStr) return; // created today, still has time

      const days = userDays.get(u.id);
      if (!days || days.size === 0) {
        neverReturnedAfterSignupCount++;
        zeroActivityAfterSignupCount++;
        dropoffSignupUserIds.push(u.id);
      } else if (days.size === 1 && days.has(signupDay)) {
        neverReturnedAfterSignupCount++;
        day1OnlyAfterSignupCount++;
        dropoffSignupUserIds.push(u.id);
      }
    });

    const totalSignups = relevantAuthUsers.length;
    const returnedAfterSignupCount = Math.max(0, totalSignups - neverReturnedAfterSignupCount);

    // ── 6. Repeat Platform Usage Distribution ────────────────────────────────
    const distBuckets = {
      day1: 0,
      days2to3: 0,
      days4to7: 0,
      days8to14: 0,
      days15plus: 0,
    };

    userDays.forEach((days) => {
      const count = days.size;
      if (count === 1) distBuckets.day1++;
      else if (count <= 3) distBuckets.days2to3++;
      else if (count <= 7) distBuckets.days4to7++;
      else if (count <= 14) distBuckets.days8to14++;
      else distBuckets.days15plus++;
    });

    const repeatUsersCount = totalProductUsers - distBuckets.day1;
    const repeatRate = totalProductUsers > 0 ? Math.round((repeatUsersCount / totalProductUsers) * 100) : 0;

    // ── 7. Cohort Retention Computation (Daily / Weekly / Monthly) ────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let headers: string[] = [];
    let cohortTable: {
      cohortDate:  string;
      cohortLabel: string;
      cohortSize:  number;
      dn:          (number | null)[];
    }[] = [];

    if (interval === "weekly") {
      headers = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

      // User first week
      const firstWeek = new Map<string, string>();
      userWeeks.forEach((weeks, uid) => {
        const sorted = [...weeks].sort();
        firstWeek.set(uid, sorted[0]);
      });

      const weeklyCohorts = new Map<string, Set<string>>();
      firstWeek.forEach((w, uid) => {
        if (!weeklyCohorts.has(w)) weeklyCohorts.set(w, new Set());
        weeklyCohorts.get(w)!.add(uid);
      });

      // Last 12 weeks
      const sortedWeeks = [...weeklyCohorts.keys()].sort().slice(-12);
      const currentWeekKey = getWeekKey(today.toISOString());

      for (const wKey of sortedWeeks) {
        const cohort = weeklyCohorts.get(wKey);
        if (!cohort || cohort.size === 0) continue;

        // Parse year & week
        const [yearStr, wPart] = wKey.split("-W");
        const yr = parseInt(yearStr, 10);
        const wk = parseInt(wPart, 10);

        const dn: (number | null)[] = [];
        for (let n = 1; n <= 8; n++) {
          const targetWk = wk + n;
          const targetYear = yr + Math.floor((targetWk - 1) / 52);
          const targetWkRem = ((targetWk - 1) % 52) + 1;
          const targetKey = `${targetYear}-W${String(targetWkRem).padStart(2, "0")}`;

          if (targetKey > currentWeekKey) {
            dn.push(null);
            continue;
          }

          const returned = [...cohort].filter((uid) => userWeeks.get(uid)?.has(targetKey)).length;
          dn.push(Math.round((returned / cohort.size) * 100));
        }

        cohortTable.push({
          cohortDate: wKey,
          cohortLabel: wKey,
          cohortSize: cohort.size,
          dn,
        });
      }
    } else if (interval === "monthly") {
      headers = ["M1", "M2", "M3", "M4", "M5", "M6"];

      const firstMonth = new Map<string, string>();
      userMonths.forEach((months, uid) => {
        const sorted = [...months].sort();
        firstMonth.set(uid, sorted[0]);
      });

      const monthlyCohorts = new Map<string, Set<string>>();
      firstMonth.forEach((m, uid) => {
        if (!monthlyCohorts.has(m)) monthlyCohorts.set(m, new Set());
        monthlyCohorts.get(m)!.add(uid);
      });

      const sortedMonths = [...monthlyCohorts.keys()].sort().slice(-8);
      const currentMonthKey = today.toISOString().slice(0, 7);

      for (const mKey of sortedMonths) {
        const cohort = monthlyCohorts.get(mKey);
        if (!cohort || cohort.size === 0) continue;

        const [yrStr, moStr] = mKey.split("-");
        const yr = parseInt(yrStr, 10);
        const mo = parseInt(moStr, 10);

        const dn: (number | null)[] = [];
        for (let n = 1; n <= 6; n++) {
          const targetMo = mo + n;
          const targetYr = yr + Math.floor((targetMo - 1) / 12);
          const targetMoRem = ((targetMo - 1) % 12) + 1;
          const targetKey = `${targetYr}-${String(targetMoRem).padStart(2, "0")}`;

          if (targetKey > currentMonthKey) {
            dn.push(null);
            continue;
          }

          const returned = [...cohort].filter((uid) => userMonths.get(uid)?.has(targetKey)).length;
          dn.push(Math.round((returned / cohort.size) * 100));
        }

        const dateObj = new Date(yr, mo - 1, 1);
        cohortTable.push({
          cohortDate: mKey,
          cohortLabel: dateObj.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
          cohortSize: cohort.size,
          dn,
        });
      }
    } else {
      // Default: daily cohorts D1–D7
      headers = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

      const firstSeen = new Map<string, string>();
      userDays.forEach((days, uid) => {
        const sorted = [...days].sort();
        firstSeen.set(uid, sorted[0]);
      });

      const cohorts = new Map<string, Set<string>>();
      firstSeen.forEach((day, uid) => {
        if (!cohorts.has(day)) cohorts.set(day, new Set());
        cohorts.get(day)!.add(uid);
      });

      for (let c = 29; c >= 0; c--) {
        const cohortDate = new Date(Date.now() - c * 86400000);
        cohortDate.setHours(0, 0, 0, 0);
        const cohortKey = cohortDate.toISOString().slice(0, 10);
        const cohort = cohorts.get(cohortKey);
        if (!cohort || cohort.size === 0) continue;

        const dn: (number | null)[] = [];
        for (let n = 1; n <= 7; n++) {
          const targetDate = new Date(cohortDate.getTime() + n * 86400000);
          targetDate.setHours(0, 0, 0, 0);
          if (targetDate > today) {
            dn.push(null);
            continue;
          }
          const targetKey = targetDate.toISOString().slice(0, 10);
          const returned = [...cohort].filter((uid) => userDays.get(uid)?.has(targetKey)).length;
          dn.push(Math.round((returned / cohort.size) * 100));
        }

        cohortTable.push({
          cohortDate: cohortKey,
          cohortLabel: cohortDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          cohortSize: cohort.size,
          dn,
        });
      }
    }

    // Rolling Dn / Wn / Mn
    const colCount = headers.length;
    const rollingDn: (number | null)[] = Array.from({ length: colCount }, (_, n) => {
      const observable = cohortTable.filter((row) => row.dn[n] !== null);
      if (observable.length === 0) return null;
      return Math.round(
        observable.reduce((s, row) => s + (row.dn[n] as number), 0) / observable.length
      );
    });

    // ── 8. Monthly Retention (Standard) ──────────────────────────────────────
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const lastMonthSet = new Set<string>();
    const thisMonthSet = new Set<string>();

    rows.forEach((r) => {
      const d = (r.answered_at as string).slice(0, 10);
      const uid = r.user_id as string;
      if (d >= lastMonthStart && d <= lastMonthEnd) lastMonthSet.add(uid);
      if (d >= thisMonthStart) thisMonthSet.add(uid);
    });

    const monthlyRetained = [...lastMonthSet].filter((uid) => thisMonthSet.has(uid)).length;
    const monthlyRetention = lastMonthSet.size > 0 ? Math.round((monthlyRetained / lastMonthSet.size) * 100) : 0;

    // ── 9. Profiles enrichment for power users & drop-off samples ─────────────
    const sevenDaysAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const highRetentionUids: string[] = [];
    userDays.forEach((days, uid) => {
      const recentDays = [...days].filter((d) => d >= sevenDaysAgoStr).length;
      if (recentDays >= 5) highRetentionUids.push(uid);
    });

    // Pick top dropoff users to enrich
    const dropoffSampleUids = [
      ...dropoffProductUserIds.slice(0, 15),
      ...dropoffSignupUserIds.slice(0, 15),
      ...highRetentionUids.slice(0, 20),
    ];
    const profileMap = await getUserProfiles([...new Set(dropoffSampleUids)]);

    const topRetainedUsers = highRetentionUids.slice(0, 20).map((uid) => {
      const p = profileMap.get(uid);
      const days = [...(userDays.get(uid) ?? [])].filter((d) => d >= sevenDaysAgoStr).length;
      return {
        userId: uid,
        name: p?.name ?? uid.slice(0, 8),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        activeDaysLast7: days,
        isPaid: paidUserIds.has(uid),
      };
    }).sort((a, b) => b.activeDaysLast7 - a.activeDaysLast7);

    const neverReturnedProductUsersSample = dropoffProductUserIds.slice(0, 15).map((uid) => {
      const p = profileMap.get(uid);
      const days = [...(userDays.get(uid) ?? [])];
      return {
        userId: uid,
        name: p?.name ?? uid.slice(0, 8),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        onlyActiveDate: days[0] ?? "",
        questionsCount: userQuestionsCount.get(uid) ?? 0,
        firstChapter: userFirstChapter.get(uid) ?? "Practice",
        isPaid: paidUserIds.has(uid),
      };
    });

    const neverReturnedSignupUsersSample = dropoffSignupUserIds.slice(0, 15).map((uid) => {
      const p = profileMap.get(uid);
      const authUser = authUsers.find((u) => u.id === uid);
      const days = userDays.get(uid);
      return {
        userId: uid,
        name: p?.name ?? uid.slice(0, 8),
        email: p?.email ?? authUser?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        signupAt: authUser?.created_at ?? "",
        activityType: (!days || days.size === 0) ? ("zero_activity" as const) : ("day1_only" as const),
        questionsCount: userQuestionsCount.get(uid) ?? 0,
        isPaid: paidUserIds.has(uid),
      };
    });

    return Response.json({
      interval,
      segment,
      headers,
      cohortTable,
      rollingDn,
      monthlyRetention,
      lastMonthActiveUsers: lastMonthSet.size,
      thisMonthActiveUsers: thisMonthSet.size,
      monthlyRetained,
      topRetainedUsers,

      // Item 1: Students who never returned after using product
      neverReturnedAfterUsing: {
        total: totalProductUsers,
        neverReturnedCount: neverReturnedAfterUsingCount,
        neverReturnedPct: totalProductUsers > 0 ? Math.round((neverReturnedAfterUsingCount / totalProductUsers) * 100) : 0,
        returnedCount: returnedProductUsers,
        returnedPct: totalProductUsers > 0 ? Math.round((returnedProductUsers / totalProductUsers) * 100) : 0,
        sampleUsers: neverReturnedProductUsersSample,
      },

      // Item 2: Students who never returned after signup
      neverReturnedAfterSignup: {
        totalSignups,
        neverReturnedCount: neverReturnedAfterSignupCount,
        neverReturnedPct: totalSignups > 0 ? Math.round((neverReturnedAfterSignupCount / totalSignups) * 100) : 0,
        zeroActivityCount: zeroActivityAfterSignupCount,
        zeroActivityPct: totalSignups > 0 ? Math.round((zeroActivityAfterSignupCount / totalSignups) * 100) : 0,
        day1OnlyCount: day1OnlyAfterSignupCount,
        day1OnlyPct: totalSignups > 0 ? Math.round((day1OnlyAfterSignupCount / totalSignups) * 100) : 0,
        returnedCount: returnedAfterSignupCount,
        returnedPct: totalSignups > 0 ? Math.round((returnedAfterSignupCount / totalSignups) * 100) : 0,
        sampleUsers: neverReturnedSignupUsersSample,
      },

      // Item 6: Repeat Platform Usage
      repeatPlatformUsage: {
        totalUsers: totalProductUsers,
        repeatUsersCount,
        repeatRate,
        distribution: [
          { label: "1 day only", days: 1, count: distBuckets.day1, pct: totalProductUsers > 0 ? Math.round((distBuckets.day1 / totalProductUsers) * 100) : 0 },
          { label: "2–3 days", days: "2-3", count: distBuckets.days2to3, pct: totalProductUsers > 0 ? Math.round((distBuckets.days2to3 / totalProductUsers) * 100) : 0 },
          { label: "4–7 days", days: "4-7", count: distBuckets.days4to7, pct: totalProductUsers > 0 ? Math.round((distBuckets.days4to7 / totalProductUsers) * 100) : 0 },
          { label: "8–14 days", days: "8-14", count: distBuckets.days8to14, pct: totalProductUsers > 0 ? Math.round((distBuckets.days8to14 / totalProductUsers) * 100) : 0 },
          { label: "15+ days", days: "15+", count: distBuckets.days15plus, pct: totalProductUsers > 0 ? Math.round((distBuckets.days15plus / totalProductUsers) * 100) : 0 },
        ],
      },
    });
  } catch (err) {
    console.error("[retention]", err);
    return Response.json(
      {
        cohortTable: [],
        rollingDn: [],
        headers: ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
        monthlyRetention: 0,
        lastMonthActiveUsers: 0,
        thisMonthActiveUsers: 0,
        monthlyRetained: 0,
        topRetainedUsers: [],
        neverReturnedAfterUsing: { total: 0, neverReturnedCount: 0, neverReturnedPct: 0, returnedCount: 0, returnedPct: 0, sampleUsers: [] },
        neverReturnedAfterSignup: { totalSignups: 0, neverReturnedCount: 0, neverReturnedPct: 0, zeroActivityCount: 0, zeroActivityPct: 0, day1OnlyCount: 0, day1OnlyPct: 0, returnedCount: 0, returnedPct: 0, sampleUsers: [] },
        repeatPlatformUsage: { totalUsers: 0, repeatUsersCount: 0, repeatRate: 0, distribution: [] },
        error: String(err),
      },
      { status: 200 }
    );
  }
}

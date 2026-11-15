import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserProfiles } from "@/lib/getUserProfiles";

export const dynamic = "force-dynamic";

async function fetchAllAttempts(sb: ReturnType<typeof createServerSupabaseClient>) {
  const PAGE_SIZE = 1000;
  let allAttempts: { id: number; student_id: string; created_at: string; correct: boolean; time_taken_sec: number }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("attempts")
      .select("id, student_id, created_at, correct, time_taken_sec")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    allAttempts = allAttempts.concat(data as any);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allAttempts;
}

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysISO = sevenDaysAgo.toISOString();

    // ── Run Supabase table queries in parallel ────────────────────────────────
    const [
      activityTodayRes,
      weeklyActivityRes,
      allActivityRes,
      ordersRes,
      entitlementsRes,
      allAttempts,
      streakStatsRes,
      recentSessionsRes,
    ] = await Promise.all([
      sb
        .from("user_activity")
        .select("user_id, chapter_title, subject_name, time_spent_seconds, is_correct, answered_at")
        .gte("answered_at", todayISO)
        .limit(10000),

      sb
        .from("user_activity")
        .select("answered_at, user_id")
        .gte("answered_at", sevenDaysISO)
        .limit(20000),

      sb
        .from("user_activity")
        .select("user_id, answered_at")
        .not("user_id", "is", null)
        .limit(50000),

      sb
        .from("orders")
        .select("id, user_id, plan_id, status, created_at, amount")
        .order("created_at", { ascending: false })
        .limit(10000),

      sb
        .from("entitlements")
        .select("user_id, access_until")
        .limit(5000),

      fetchAllAttempts(sb),

      sb.from("user_streaks").select("current_streak, longest_streak"),

      sb
        .from("user_recent_session")
        .select("user_id, chapter_title, subject_name, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    // ── Per-query error surface ───────────────────────────────────────────────
    const queryErrors: Record<string, string> = {};
    if (activityTodayRes.error)  queryErrors.activityToday  = activityTodayRes.error.message;
    if (weeklyActivityRes.error) queryErrors.weeklyActivity = weeklyActivityRes.error.message;
    if (streakStatsRes.error)    queryErrors.streakStats    = streakStatsRes.error.message;
    if (recentSessionsRes.error) queryErrors.recentSessions = recentSessionsRes.error.message;
    if (ordersRes.error)         queryErrors.orders         = ordersRes.error.message;

    const activityRows = activityTodayRes.data  ?? [];
    const weeklyRows   = weeklyActivityRes.data ?? [];
    const allActRows   = allActivityRes.data    ?? [];
    const orderRows    = ordersRes.data         ?? [];
    const entRows      = entitlementsRes.data   ?? [];
    const streakRows   = streakStatsRes.data    ?? [];
    const recentRows   = recentSessionsRes.data ?? [];

    // Filter today's attempts from append-only table
    const attemptsToday = allAttempts.filter((a) => a.created_at >= todayISO);

    // ── Paid users set ────────────────────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const paidUserIds = new Set<string>();
    entRows.forEach((e) => {
      if ((e.access_until as string) > nowIso) paidUserIds.add(e.user_id as string);
    });
    orderRows.forEach((o) => {
      if (o.status === "paid") paidUserIds.add(o.user_id as string);
    });

    // ── 1. Active students today (attempts + user_activity union) ─────────────
    const activeStudentIds = new Set([
      ...attemptsToday.map((a) => a.student_id).filter(Boolean),
      ...activityRows.map((r) => r.user_id as string | null).filter(Boolean),
    ]);
    const activeStudentsToday = activeStudentIds.size;

    // ── 2. Total questions solved today ───────────────────────────────────────
    // attempts is append-only log; user_activity is distinct chapter questions
    const totalQuestionsToday = Math.max(attemptsToday.length, activityRows.length);

    // ── 3. Avg time per question ──────────────────────────────────────────────
    const attemptTimes = attemptsToday
      .map((a) => a.time_taken_sec)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const uaTimes = activityRows
      .map((r) => r.time_spent_seconds as number | null)
      .filter((t): t is number => typeof t === "number" && t > 0);
    const timeSamples = attemptTimes.length > 0 ? attemptTimes : uaTimes;
    const avgTimeSec =
      timeSamples.length > 0
        ? Math.round(timeSamples.reduce((a, b) => a + b, 0) / timeSamples.length)
        : 0;

    // ── 4. Accuracy rate today ────────────────────────────────────────────────
    let accuracyRate = 0;
    if (attemptsToday.length > 0) {
      const correctAttempts = attemptsToday.filter((a) => a.correct).length;
      accuracyRate = Math.round((correctAttempts / attemptsToday.length) * 100);
    } else if (activityRows.length > 0) {
      const correctUa = activityRows.filter((r) => r.is_correct === true).length;
      accuracyRate = Math.round((correctUa / activityRows.length) * 100);
    }

    // ── 5. Top chapters today ─────────────────────────────────────────────────
    const chapterMap: Record<string, { count: number; subject: string }> = {};
    activityRows.forEach((r) => {
      const key = r.chapter_title as string;
      if (!chapterMap[key]) {
        chapterMap[key] = { count: 0, subject: (r.subject_name as string) ?? "General" };
      }
      chapterMap[key].count++;
    });
    const topChapters = Object.entries(chapterMap)
      .map(([title, { count, subject }]) => ({ title, count, subject }))
      .sort((a, b) => b.count - a.count);

    // ── 6. 7-day sparkline ────────────────────────────────────────────────────
    const dayBuckets: Record<string, Set<string>> = {};
    // Union weekly rows from activity + attempts
    weeklyRows.forEach((r) => {
      const day = (r.answered_at as string).slice(0, 10);
      if (!dayBuckets[day]) dayBuckets[day] = new Set();
      if (r.user_id) dayBuckets[day].add(r.user_id as string);
    });
    allAttempts
      .filter((a) => a.created_at >= sevenDaysISO)
      .forEach((a) => {
        const day = a.created_at.slice(0, 10);
        if (!dayBuckets[day]) dayBuckets[day] = new Set();
        if (a.student_id) dayBuckets[day].add(a.student_id);
      });

    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const d   = new Date(Date.now() - (6 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        date:  key,
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        users: dayBuckets[key]?.size ?? 0,
      };
    });

    // ── 7. Retention (yesterday -> today) ─────────────────────────────────────
    const todayStr     = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const todaySet = dayBuckets[todayStr] ?? new Set();
    const yesterdaySet = dayBuckets[yesterdayStr] ?? new Set();
    const retainedCount = [...yesterdaySet].filter((uid) => todaySet.has(uid)).length;
    const retention =
      yesterdaySet.size > 0
        ? Math.round((retainedCount / yesterdaySet.size) * 100)
        : 0;

    // ── 8. Streak stats ───────────────────────────────────────────────────────
    const avgStreak =
      streakRows.length > 0
        ? Math.round(
            streakRows.reduce((s, r) => s + ((r.current_streak as number) ?? 0), 0) /
              streakRows.length
          )
        : 0;
    const maxStreak =
      streakRows.length > 0
        ? Math.max(...streakRows.map((r) => (r.longest_streak as number) ?? 0))
        : 0;

    // ── Item 3: Multiple Checkout Openers Analysis ────────────────────────────
    const userOrderMap = new Map<string, {
      count: number;
      paid: boolean;
      plans: Set<string>;
      lastCheckoutAt: string;
      firstCheckoutAt: string;
    }>();

    orderRows.forEach((o) => {
      const uid = o.user_id as string;
      if (!uid) return;
      const createdAt = o.created_at as string;
      const isPaid = o.status === "paid";
      const plan = (o.plan_id as string) ?? "rookie_pass_yearly";

      if (!userOrderMap.has(uid)) {
        userOrderMap.set(uid, {
          count: 0,
          paid: false,
          plans: new Set(),
          lastCheckoutAt: createdAt,
          firstCheckoutAt: createdAt,
        });
      }
      const uData = userOrderMap.get(uid)!;
      uData.count++;
      if (isPaid) uData.paid = true;
      uData.plans.add(plan);
      if (createdAt > uData.lastCheckoutAt) uData.lastCheckoutAt = createdAt;
      if (createdAt < uData.firstCheckoutAt) uData.firstCheckoutAt = createdAt;
    });

    const totalCheckoutOpeners = userOrderMap.size;
    const multiCheckoutEntries = [...userOrderMap.entries()].filter(([_, v]) => v.count > 1);

    // SORT BY MOST RECENT FIRST!
    multiCheckoutEntries.sort((a, b) => b[1].lastCheckoutAt.localeCompare(a[1].lastCheckoutAt));

    const multiCheckoutConverted = multiCheckoutEntries.filter(([_, v]) => v.paid || paidUserIds.has(_)).length;
    const multiCheckoutAbandoned = multiCheckoutEntries.length - multiCheckoutConverted;

    // ── Item 5: Daily Limit Exceeded Analysis (> 3 questions/day) ─────────────
    // Querying against public.attempts (append-only) dynamically across all dates
    const userDayActivity = new Map<string, Map<string, number>>(); // uid -> day -> count

    allAttempts.forEach((a) => {
      const uid = a.student_id;
      if (!uid) return;
      const day = a.created_at.slice(0, 10);
      if (!userDayActivity.has(uid)) userDayActivity.set(uid, new Map());
      const dayMap = userDayActivity.get(uid)!;
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    });

    // Also include user_activity rows if any were not recorded in attempts
    allActRows.forEach((r) => {
      const uid = r.user_id as string;
      if (!uid) return;
      const day = (r.answered_at as string).slice(0, 10);
      if (!userDayActivity.has(uid)) userDayActivity.set(uid, new Map());
      const dayMap = userDayActivity.get(uid)!;
      if (!dayMap.has(day)) {
        dayMap.set(day, 1);
      }
    });

    interface ExceededUserEntry {
      userId: string;
      maxInSingleDay: number;
      totalAnswered: number;
      daysExceededCount: number;
      lastExceededDate: string;
      isPaid: boolean;
    }

    const exceededUsersList: ExceededUserEntry[] = [];
    const keptSolvingBuckets = {
      q4to5: 0,
      q6to10: 0,
      q11to20: 0,
      q21plus: 0,
    };

    userDayActivity.forEach((days, uid) => {
      let maxCount = 0;
      let totalCount = 0;
      let daysExceeded = 0;
      let lastDate = "";

      days.forEach((count, day) => {
        totalCount += count;
        if (count > maxCount) maxCount = count;
        if (count > 3) {
          daysExceeded++;
          if (!lastDate || day > lastDate) lastDate = day;
        }
      });

      if (daysExceeded > 0) {
        exceededUsersList.push({
          userId: uid,
          maxInSingleDay: maxCount,
          totalAnswered: totalCount,
          daysExceededCount: daysExceeded,
          lastExceededDate: lastDate,
          isPaid: paidUserIds.has(uid),
        });

        if (maxCount <= 5) keptSolvingBuckets.q4to5++;
        else if (maxCount <= 10) keptSolvingBuckets.q6to10++;
        else if (maxCount <= 20) keptSolvingBuckets.q11to20++;
        else keptSolvingBuckets.q21plus++;
      }
    });

    // SORT BY MOST RECENT FIRST!
    exceededUsersList.sort((a, b) => b.lastExceededDate.localeCompare(a.lastExceededDate) || b.maxInSingleDay - a.maxInSingleDay);

    // ── Fetch profiles for recent sessions + multi-checkout + top limit exceeded ─
    const recentUserIds = recentRows.map((r) => r.user_id as string).filter(Boolean);
    const multiCheckoutUids = multiCheckoutEntries.slice(0, 50).map(([uid]) => uid);
    const exceededUids = exceededUsersList.slice(0, 50).map((u) => u.userId);

    const allProfileUids = [...new Set([...recentUserIds, ...multiCheckoutUids, ...exceededUids])];
    const profileMap = await getUserProfiles(allProfileUids);

    // ── 9. Recent users — enriched with auth profile ──────────────────────────
    const recentUsers = recentRows.map((r) => {
      const uid     = r.user_id as string;
      const profile = profileMap.get(uid);
      return {
        userId:    uid,
        name:      profile?.name      ?? uid.slice(0, 8),
        email:     profile?.email     ?? "",
        avatarUrl: profile?.avatarUrl ?? "",
        chapter:   r.chapter_title as string,
        subject:   (r.subject_name as string) ?? "—",
        lastSeen:  r.updated_at as string,
      };
    });

    // Enriched Multi Checkout Users List (Most Recent First)
    const multipleCheckoutUsers = {
      totalOpeners: totalCheckoutOpeners,
      multiOpenersCount: multiCheckoutEntries.length,
      multiOpenersRate: totalCheckoutOpeners > 0 ? Math.round((multiCheckoutEntries.length / totalCheckoutOpeners) * 100) : 0,
      convertedCount: multiCheckoutConverted,
      abandonedCount: multiCheckoutAbandoned,
      users: multiCheckoutEntries.slice(0, 40).map(([uid, v]) => {
        const p = profileMap.get(uid);
        const isPaid = v.paid || paidUserIds.has(uid);
        return {
          userId: uid,
          name: p?.name ?? uid.slice(0, 8),
          email: p?.email ?? "",
          avatarUrl: p?.avatarUrl ?? "",
          checkoutCount: v.count,
          isPaid,
          status: isPaid ? ("paid" as const) : ("abandoned" as const),
          planId: [...v.plans].join(", ") || "rookie_pass_yearly",
          lastCheckoutAt: v.lastCheckoutAt,
          firstCheckoutAt: v.firstCheckoutAt,
        };
      }),
    };

    // Enriched Limit Exceeded Users List (Most Recent First)
    const limitExceededUsers = {
      totalSolvers: userDayActivity.size,
      exceededCount: exceededUsersList.length,
      exceededRate: userDayActivity.size > 0 ? Math.round((exceededUsersList.length / userDayActivity.size) * 100) : 0,
      keptSolvingBuckets,
      users: exceededUsersList.slice(0, 40).map((u) => {
        const p = profileMap.get(u.userId);
        return {
          ...u,
          name: p?.name ?? u.userId.slice(0, 8),
          email: p?.email ?? "",
          avatarUrl: p?.avatarUrl ?? "",
        };
      }),
    };

    return Response.json({
      activeStudentsToday,
      totalQuestionsToday,
      avgTimeSec,
      accuracyRate,
      retention,
      avgStreak,
      maxStreak,
      topChapters,
      weeklyActivity,
      recentUsers,
      multipleCheckoutUsers,
      limitExceededUsers,
      _debug: {
        attemptsTotal:       allAttempts.length,
        attemptsToday:       attemptsToday.length,
        activityRowsToday:   activityRows.length,
        errors:              queryErrors,
      },
    });
  } catch (err) {
    console.error("[metrics]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

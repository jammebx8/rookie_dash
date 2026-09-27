import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    // Run all queries in parallel for speed
    const [
      activeStudentsRes,
      totalQuestionsRes,
      avgTimeRes,
      topChaptersRes,
      correctRateRes,
      weeklyActivityRes,
      streakStatsRes,
      recentUsersRes,
    ] = await Promise.all([
      // 1. Distinct students who solved questions today
      sb
        .from("user_activity")
        .select("user_id", { count: "exact", head: false })
        .gte("answered_at", new Date().toISOString().slice(0, 10))
        .not("user_id", "is", null),

      // 2. Total questions solved today
      sb
        .from("user_activity")
        .select("id", { count: "exact", head: true })
        .gte("answered_at", new Date().toISOString().slice(0, 10)),

      // 3. Average time per question today (seconds)
      sb
        .from("user_activity")
        .select("time_spent_seconds")
        .gte("answered_at", new Date().toISOString().slice(0, 10))
        .not("time_spent_seconds", "is", null),

      // 4. Top chapters today
      sb
        .from("user_activity")
        .select("chapter_title, subject_name")
        .gte("answered_at", new Date().toISOString().slice(0, 10)),

      // 5. Correct vs incorrect today (for accuracy rate)
      sb
        .from("user_activity")
        .select("is_correct")
        .gte("answered_at", new Date().toISOString().slice(0, 10)),

      // 6. Daily activity for the last 7 days (for sparkline)
      sb
        .from("user_activity")
        .select("answered_at, user_id")
        .gte(
          "answered_at",
          new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
        ),

      // 7. Streak stats — avg / max current streak
      sb.from("user_streaks").select("current_streak, longest_streak"),

      // 8. Recent active users with their last session
      sb
        .from("user_recent_session")
        .select("user_id, chapter_title, subject_name, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    // ── derive distinct active students today ──
    const activeStudentIds = new Set(
      (activeStudentsRes.data ?? []).map((r: { user_id: string }) => r.user_id)
    );
    const activeStudentsToday = activeStudentIds.size;

    // ── total questions ──
    const totalQuestionsToday = totalQuestionsRes.count ?? 0;

    // ── avg time ──
    const times = (avgTimeRes.data ?? [])
      .map((r: { time_spent_seconds: number }) => r.time_spent_seconds)
      .filter((t: number) => t > 0);
    const avgTimeSec =
      times.length > 0
        ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length)
        : 0;

    // ── top chapters ──
    const chapterMap: Record<string, { count: number; subject: string }> = {};
    (topChaptersRes.data ?? []).forEach(
      (r: { chapter_title: string; subject_name: string | null }) => {
        const key = r.chapter_title;
        if (!chapterMap[key]) {
          chapterMap[key] = { count: 0, subject: r.subject_name ?? "General" };
        }
        chapterMap[key].count++;
      }
    );
    const topChapters = Object.entries(chapterMap)
      .map(([title, { count, subject }]) => ({ title, count, subject }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── accuracy rate ──
    const correctData = correctRateRes.data ?? [];
    const totalAnswered = correctData.length;
    const totalCorrect = correctData.filter(
      (r: { is_correct: boolean | null }) => r.is_correct === true
    ).length;
    const accuracyRate =
      totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    // ── 7-day activity sparkline ──
    const dayBuckets: Record<string, Set<string>> = {};
    (weeklyActivityRes.data ?? []).forEach(
      (r: { answered_at: string; user_id: string }) => {
        const day = r.answered_at.slice(0, 10);
        if (!dayBuckets[day]) dayBuckets[day] = new Set();
        if (r.user_id) dayBuckets[day].add(r.user_id);
      }
    );
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        date: key,
        label: d.toLocaleDateString("en-IN", { weekday: "short" }),
        users: dayBuckets[key]?.size ?? 0,
      };
    });

    // ── streak stats ──
    const streaks = streakStatsRes.data ?? [];
    const avgStreak =
      streaks.length > 0
        ? Math.round(
            streaks.reduce(
              (s: number, r: { current_streak: number }) => s + r.current_streak,
              0
            ) / streaks.length
          )
        : 0;
    const maxStreak =
      streaks.length > 0
        ? Math.max(
            ...streaks.map((r: { longest_streak: number }) => r.longest_streak)
          )
        : 0;

    // ── retention: % of users who were active yesterday AND today ──
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);

    const todayUsers = new Set(
      (weeklyActivityRes.data ?? [])
        .filter((r: { answered_at: string }) => r.answered_at.slice(0, 10) === todayStr)
        .map((r: { user_id: string }) => r.user_id)
    );
    const yesterdayUsers = new Set(
      (weeklyActivityRes.data ?? [])
        .filter((r: { answered_at: string }) => r.answered_at.slice(0, 10) === yesterdayStr)
        .map((r: { user_id: string }) => r.user_id)
    );
    const retainedUsers = [...yesterdayUsers].filter((uid) =>
      todayUsers.has(uid)
    ).length;
    const retention =
      yesterdayUsers.size > 0
        ? Math.round((retainedUsers / yesterdayUsers.size) * 100)
        : 0;

    // ── recent users ──
    const recentUsers = (recentUsersRes.data ?? []).map(
      (r: {
        user_id: string;
        chapter_title: string;
        subject_name: string | null;
        updated_at: string;
      }) => ({
        userId: r.user_id,
        shortId: r.user_id.slice(0, 8),
        chapter: r.chapter_title,
        subject: r.subject_name ?? "—",
        lastSeen: r.updated_at,
      })
    );

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
    });
  } catch (err) {
    console.error("[metrics]", err);
    return Response.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

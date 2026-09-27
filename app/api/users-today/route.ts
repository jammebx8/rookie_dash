import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserProfiles } from "@/lib/getUserProfiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [activityRes, sessionsRes] = await Promise.all([
      sb
        .from("user_activity")
        .select("user_id, chapter_title, subject_name, time_spent_seconds, answered_at")
        .gte("answered_at", todayISO)
        .order("answered_at", { ascending: false })
        .limit(5000),

      sb
        .from("user_recent_session")
        .select("user_id, chapter_title, subject_name, updated_at"),
    ]);

    const errors: Record<string, string> = {};
    if (activityRes.error) errors.activity = activityRes.error.message;
    if (sessionsRes.error) errors.sessions = sessionsRes.error.message;

    const activityRows = activityRes.data ?? [];
    const sessionRows  = sessionsRes.data  ?? [];

    const sessionMap = new Map(
      sessionRows.map((r) => [r.user_id as string, r])
    );

    // Aggregate per-user totals
    type UserAgg = {
      userId:        string;
      totalTimeSec:  number;
      questionCount: number;
      firstSeenAt:   string;
      lastSeenAt:    string;
      chapter:       string;
      subject:       string;
    };

    const userMap = new Map<string, UserAgg>();

    activityRows.forEach((r) => {
      const uid = r.user_id as string | null;
      if (!uid) return;

      const timeSec    = (r.time_spent_seconds as number) ?? 0;
      const answeredAt = r.answered_at as string;
      const session    = sessionMap.get(uid);

      if (!userMap.has(uid)) {
        userMap.set(uid, {
          userId:        uid,
          totalTimeSec:  timeSec,
          questionCount: 1,
          firstSeenAt:   answeredAt,
          lastSeenAt:    answeredAt,
          chapter:       (r.chapter_title as string) ?? session?.chapter_title ?? "—",
          subject:       (r.subject_name  as string) ?? session?.subject_name  ?? "—",
        });
      } else {
        const agg = userMap.get(uid)!;
        agg.totalTimeSec  += timeSec;
        agg.questionCount += 1;
        if (answeredAt < agg.firstSeenAt) agg.firstSeenAt = answeredAt;
      }
    });

    const rawUsers = Array.from(userMap.values()).sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );

    // ── Enrich with auth.users profiles ──────────────────────────────────────
    const profileMap = await getUserProfiles(rawUsers.map((u) => u.userId));

    const usersToday = rawUsers.map((u) => {
      const profile = profileMap.get(u.userId);
      return {
        userId:        u.userId,
        name:          profile?.name      ?? u.userId.slice(0, 8),
        email:         profile?.email     ?? "",
        avatarUrl:     profile?.avatarUrl ?? "",
        totalTimeSec:  u.totalTimeSec,
        questionCount: u.questionCount,
        firstSeenAt:   u.firstSeenAt,
        lastSeenAt:    u.lastSeenAt,
        chapter:       u.chapter,
        subject:       u.subject,
      };
    });

    const totalVisitors = usersToday.length;
    const avgDurationSec =
      totalVisitors > 0
        ? Math.round(
            usersToday.reduce((s, u) => s + u.totalTimeSec, 0) / totalVisitors
          )
        : 0;

    return Response.json({
      totalVisitors,
      avgDurationSec,
      usersToday,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("[users-today]", err);
    return Response.json(
      {
        totalVisitors: 0,
        avgDurationSec: 0,
        usersToday: [],
        error: String(err),
        hint: "Check SUPABASE_SERVICE_ROLE_KEY in .env and restart the dev server.",
      },
      { status: 200 }
    );
  }
}

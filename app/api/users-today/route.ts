/**
 * /api/users-today
 *
 * Returns every distinct user who touched the platform today,
 * built entirely from Supabase tables — no Firebase needed.
 *
 * Sources used:
 *   user_activity      → question-level events (answered_at, time_spent_seconds)
 *   user_recent_session → last known chapter / subject per user
 *   attempts           → raw attempt timer if user_activity time is missing
 */

import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Fetch today's activity rows and the last-session snapshot in parallel
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
    if (activityRes.error)  errors.activity  = activityRes.error.message;
    if (sessionsRes.error)  errors.sessions  = sessionsRes.error.message;

    const activityRows = activityRes.data ?? [];
    const sessionRows  = sessionsRes.data  ?? [];

    // Build a map of last-session info keyed by user_id
    const sessionMap = new Map(
      sessionRows.map((r) => [r.user_id as string, r])
    );

    // Aggregate per-user: total time on platform today + last seen timestamp
    type UserAgg = {
      userId:       string;
      shortId:      string;
      totalTimeSec: number;
      questionCount: number;
      firstSeenAt:  string;
      lastSeenAt:   string;
      chapter:      string;
      subject:      string;
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
          shortId:       uid.slice(0, 8),
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
        // answered_at rows come desc, so first row is latest — keep track of earliest too
        if (answeredAt < agg.firstSeenAt) agg.firstSeenAt = answeredAt;
      }
    });

    const usersToday = Array.from(userMap.values()).sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );

    const totalVisitors = usersToday.length;

    // Average total time on platform per user today
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
        hint: "Check that SUPABASE_SERVICE_ROLE_KEY is set in .env and the dev server was restarted.",
      },
      { status: 200 }
    );
  }
}

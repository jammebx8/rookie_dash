/**
 * /api/engagement
 *
 * Definitions (as specified):
 *   Active Users = users with activity in attempts, user_activity, OR user_recent_session today
 *   DAU = active users today (above definition)
 *   WAU = unique active users over last 7 days (same union)
 *   MAU = unique active users over last 30 days (same union)
 *
 * Stickiness = DAU / MAU
 */
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysISO = sevenDaysAgo.toISOString();

    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysISO = thirtyDaysAgo.toISOString();

    // Fetch all three activity sources in parallel for last 30 days
    const [activityRes, attemptsRes, sessionsRes] = await Promise.all([
      // user_activity — primary engagement signal
      sb
        .from("user_activity")
        .select("user_id, answered_at")
        .gte("answered_at", thirtyDaysISO)
        .not("user_id", "is", null)
        .limit(50000),

      // attempts — raw attempt events (student_id, created_at)
      sb
        .from("attempts")
        .select("student_id, created_at")
        .gte("created_at", thirtyDaysISO)
        .limit(50000),

      // user_recent_session — updated_at signals a session event
      sb
        .from("user_recent_session")
        .select("user_id, updated_at")
        .gte("updated_at", thirtyDaysISO),
    ]);

    const errors: Record<string, string> = {};
    if (activityRes.error)  errors.activity  = activityRes.error.message;
    if (attemptsRes.error)  errors.attempts  = attemptsRes.error.message;
    if (sessionsRes.error)  errors.sessions  = sessionsRes.error.message;

    // ── Normalise all sources into { uid, day } tuples ────────────────────────
    type Event = { uid: string; day: string };
    const events: Event[] = [];

    (activityRes.data ?? []).forEach((r) => {
      if (r.user_id) events.push({ uid: r.user_id as string, day: (r.answered_at as string).slice(0, 10) });
    });
    (attemptsRes.data ?? []).forEach((r) => {
      if (r.student_id) events.push({ uid: r.student_id as string, day: (r.created_at as string).slice(0, 10) });
    });
    (sessionsRes.data ?? []).forEach((r) => {
      if (r.user_id) events.push({ uid: r.user_id as string, day: (r.updated_at as string).slice(0, 10) });
    });

    const todayStr       = todayStart.toISOString().slice(0, 10);
    const sevenDaysStr   = sevenDaysISO.slice(0, 10);
    const thirtyDaysStr  = thirtyDaysISO.slice(0, 10);

    const dauSet = new Set<string>();
    const wauSet = new Set<string>();
    const mauSet = new Set<string>();

    events.forEach(({ uid, day }) => {
      if (day >= thirtyDaysStr) mauSet.add(uid);
      if (day >= sevenDaysStr)  wauSet.add(uid);
      if (day === todayStr)     dauSet.add(uid);
    });

    const dau = dauSet.size;
    const wau = wauSet.size;
    const mau = mauSet.size;
    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // ── Per-day DAU timeseries (30 days) ──────────────────────────────────────
    // Uses union of all three sources — same definition as DAU above
    const dayMap: Record<string, Set<string>> = {};
    events.forEach(({ uid, day }) => {
      if (!dayMap[day]) dayMap[day] = new Set();
      dayMap[day].add(uid);
    });

    const dauTimeseries = Array.from({ length: 30 }, (_, i) => {
      const d   = new Date(Date.now() - (29 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        date:  key,
        label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        dau:   dayMap[key]?.size ?? 0,
      };
    });

    return Response.json({
      dau, wau, mau, stickiness,
      dauTimeseries,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("[engagement]", err);
    return Response.json({
      dau: 0, wau: 0, mau: 0, stickiness: 0, dauTimeseries: [], error: String(err),
    }, { status: 200 });
  }
}

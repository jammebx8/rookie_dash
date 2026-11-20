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

    // Fetch all activity sources + analytics events in parallel for last 30 days
    const [activityRes, attemptsRes, sessionsRes, analyticsRes] = await Promise.all([
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

      // analytics_events — tracks website visits, page views, and device metadata
      sb
        .from("analytics_events")
        .select("student_id, session_id, event_name, ts, metadata")
        .gte("ts", thirtyDaysISO)
        .limit(50000),
    ]);

    const errors: Record<string, string> = {};
    if (activityRes.error)  errors.activity  = activityRes.error.message;
    if (attemptsRes.error)  errors.attempts  = attemptsRes.error.message;
    if (sessionsRes.error)  errors.sessions  = sessionsRes.error.message;
    if (analyticsRes.error) errors.analytics = analyticsRes.error.message;

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

    // ── Website Visits & Device Breakdown from analytics_events ───────────────
    const analyticsRows = analyticsRes.data ?? [];

    let websiteVisitsToday = 0;
    let websiteVisits7d = 0;
    let websiteVisits30d = 0;

    const uniqueVisitorSessionsToday = new Set<string>();
    const uniqueVisitorSessions7d = new Set<string>();
    const uniqueVisitorSessions30d = new Set<string>();

    let mobileEvents = 0;
    let desktopEvents = 0;
    const mobileSessions = new Set<string>();
    const desktopSessions = new Set<string>();

    let mobileToday = 0;
    let desktopToday = 0;

    analyticsRows.forEach((row) => {
      const ts = (row.ts as string) || "";
      const day = ts.slice(0, 10);
      const isToday = day === todayStr;
      const is7d = day >= sevenDaysStr;
      const is30d = day >= thirtyDaysStr;

      const meta = (row.metadata as Record<string, any>) || {};
      const dev = meta.device === "mobile" ? "mobile" : meta.device === "desktop" ? "desktop" : "desktop";
      const identifier = (row.student_id as string) || (row.session_id as string) || String(Math.random());

      // Count website visits (either explicit website_visit or any page/session event)
      if (row.event_name === "website_visit" || row.event_name === "session_started" || !row.event_name.startsWith("test_")) {
        if (isToday) {
          websiteVisitsToday++;
          uniqueVisitorSessionsToday.add(identifier);
        }
        if (is7d) {
          websiteVisits7d++;
          uniqueVisitorSessions7d.add(identifier);
        }
        if (is30d) {
          websiteVisits30d++;
          uniqueVisitorSessions30d.add(identifier);
        }
      }

      // Device categorization
      if (dev === "mobile") {
        mobileEvents++;
        mobileSessions.add(identifier);
        if (isToday) mobileToday++;
      } else {
        desktopEvents++;
        desktopSessions.add(identifier);
        if (isToday) desktopToday++;
      }
    });

    const totalTrackedSessions = mobileSessions.size + desktopSessions.size;
    const mobilePct = totalTrackedSessions > 0 ? Math.round((mobileSessions.size / totalTrackedSessions) * 100) : 55;
    const desktopPct = totalTrackedSessions > 0 ? (100 - mobilePct) : 45;

    const deviceStats = {
      mobileUsers: mobileSessions.size,
      desktopUsers: desktopSessions.size,
      mobileVisits: mobileEvents,
      desktopVisits: desktopEvents,
      mobilePct,
      desktopPct,
      mobileToday,
      desktopToday,
    };

    const uniqueVisToday = uniqueVisitorSessionsToday.size;
    const conversionToActivePct = uniqueVisToday > 0 ? Math.min(100, Math.round((dau / uniqueVisToday) * 100)) : 0;

    const websiteTraffic = {
      visitsToday: websiteVisitsToday,
      visits7d: websiteVisits7d,
      visits30d: websiteVisits30d,
      uniqueVisitorsToday: uniqueVisToday,
      uniqueVisitors7d: uniqueVisitorSessions7d.size,
      uniqueVisitors30d: uniqueVisitorSessions30d.size,
      conversionToActivePct,
    };

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
      deviceStats,
      websiteTraffic,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("[engagement]", err);
    return Response.json({
      dau: 0, wau: 0, mau: 0, stickiness: 0, dauTimeseries: [],
      deviceStats: { mobileUsers: 0, desktopUsers: 0, mobileVisits: 0, desktopVisits: 0, mobilePct: 50, desktopPct: 50, mobileToday: 0, desktopToday: 0 },
      websiteTraffic: { visitsToday: 0, visits7d: 0, visits30d: 0, uniqueVisitorsToday: 0, uniqueVisitors7d: 0, uniqueVisitors30d: 0, conversionToActivePct: 0 },
      error: String(err),
    }, { status: 200 });
  }
}

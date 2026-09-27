/**
 * /api/engagement
 * DAU / WAU / MAU computed from user_activity.answered_at
 */
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Pull 30 days of (user_id, answered_at) — enough for DAU/WAU/MAU
    const { data, error } = await sb
      .from("user_activity")
      .select("user_id, answered_at")
      .gte("answered_at", thirtyDaysAgo.toISOString())
      .not("user_id", "is", null)
      .limit(50000);

    if (error) throw new Error(error.message);

    const rows = data ?? [];

    const todayStr = todayStart.toISOString().slice(0, 10);
    const sevenDaysAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const dauSet  = new Set<string>();
    const wauSet  = new Set<string>();
    const mauSet  = new Set<string>();

    rows.forEach((r) => {
      const uid = r.user_id as string;
      const day = (r.answered_at as string).slice(0, 10);
      mauSet.add(uid);
      if (day >= sevenDaysAgoStr) wauSet.add(uid);
      if (day === todayStr)       dauSet.add(uid);
    });

    const dau = dauSet.size;
    const wau = wauSet.size;
    const mau = mauSet.size;

    // DAU/MAU ratio (stickiness) as a percentage
    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // Daily active users for last 30 days (for chart)
    const dayMap: Record<string, Set<string>> = {};
    rows.forEach((r) => {
      const day = (r.answered_at as string).slice(0, 10);
      if (!dayMap[day]) dayMap[day] = new Set();
      dayMap[day].add(r.user_id as string);
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

    return Response.json({ dau, wau, mau, stickiness, dauTimeseries });
  } catch (err) {
    console.error("[engagement]", err);
    return Response.json({ dau: 0, wau: 0, mau: 0, stickiness: 0, dauTimeseries: [], error: String(err) }, { status: 200 });
  }
}

/**
 * /api/signups
 * Returns total registered users from auth.users via the Admin API,
 * plus a 30-day daily new-signup timeseries.
 */
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    // listUsers paginates at 1000 — for >1000 users loop until exhausted
    let allUsers: { id: string; created_at: string; email?: string }[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      allUsers = allUsers.concat(
        data.users.map((u) => ({ id: u.id, created_at: u.created_at, email: u.email }))
      );
      if (data.users.length < 1000) break;
      page++;
    }

    const totalUsers = allUsers.length;

    // New signups per day for last 30 days
    const buckets: Record<string, number> = {};
    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    allUsers.forEach((u) => {
      const d = new Date(u.created_at);
      if (d >= thirtyDaysAgo) {
        const key = d.toISOString().slice(0, 10);
        buckets[key] = (buckets[key] ?? 0) + 1;
      }
    });

    const signupTimeseries = Array.from({ length: 30 }, (_, i) => {
      const d   = new Date(Date.now() - (29 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        date:  key,
        label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        count: buckets[key] ?? 0,
      };
    });

    const newSignupsToday = buckets[new Date().toISOString().slice(0, 10)] ?? 0;
    const newSignupsThisWeek = Object.entries(buckets)
      .filter(([k]) => k >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10))
      .reduce((s, [, v]) => s + v, 0);

    return Response.json({ totalUsers, newSignupsToday, newSignupsThisWeek, signupTimeseries });
  } catch (err) {
    console.error("[signups]", err);
    return Response.json({ totalUsers: 0, newSignupsToday: 0, newSignupsThisWeek: 0, signupTimeseries: [], error: String(err) }, { status: 200 });
  }
}

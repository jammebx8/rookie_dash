/**
 * /api/signups
 *
 * Three distinct counts:
 *   totalAccounts  — auth.users (everyone who created an account)
 *   totalStudents  — public.users (users who completed onboarding / have a profile row)
 *   conversionRate — totalStudents / totalAccounts %
 *
 * Also returns 30-day signup timeseries and new-signup counts.
 */
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    // ── 1. Total auth accounts — paginate through all pages ──────────────────
    let authUsers: { id: string; created_at: string }[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
      authUsers = authUsers.concat(
        data.users.map((u) => ({ id: u.id, created_at: u.created_at }))
      );
      if (data.users.length < 1000) break;
      page++;
    }
    const totalAccounts = authUsers.length;

    // ── 2. Total students — public.users row count ────────────────────────────
    // We select just the id column with count to avoid fetching all columns.
    const { count: studentCount, error: studentErr } = await sb
      .from("users")
      .select("id", { count: "exact", head: true });

    const totalStudents  = studentCount ?? 0;
    const studentError   = studentErr?.message;

    const conversionRate = totalAccounts > 0
      ? Math.round((totalStudents / totalAccounts) * 100)
      : 0;

    // ── 3. 30-day signup timeseries (from auth.users created_at) ─────────────
    const buckets: Record<string, number> = {};
    const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    authUsers.forEach((u) => {
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

    const newSignupsToday    = buckets[new Date().toISOString().slice(0, 10)] ?? 0;
    const newSignupsThisWeek = Object.entries(buckets)
      .filter(([k]) => k >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10))
      .reduce((s, [, v]) => s + v, 0);

    return Response.json({
      totalAccounts,
      totalStudents,
      conversionRate,
      newSignupsToday,
      newSignupsThisWeek,
      signupTimeseries,
      ...(studentError ? { studentError } : {}),
    });
  } catch (err) {
    console.error("[signups]", err);
    return Response.json({
      totalAccounts: 0,
      totalStudents: 0,
      conversionRate: 0,
      newSignupsToday: 0,
      newSignupsThisWeek: 0,
      signupTimeseries: [],
      error: String(err),
    }, { status: 200 });
  }
}

import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    // ── Fetch raw data in parallel ─────────────────────────────────────────
    const [ordersRes, entitlementsRes] = await Promise.all([
      sb
        .from("orders")
        .select("id, user_id, amount, status, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(5000),

      sb
        .from("entitlements")
        .select("user_id, plan_id, access_until, granted_at")
        .limit(5000),
    ]);

    if (ordersRes.error)       throw new Error(`orders: ${ordersRes.error.message}`);
    if (entitlementsRes.error) throw new Error(`entitlements: ${entitlementsRes.error.message}`);

    const orders       = ordersRes.data       ?? [];
    const entitlements = entitlementsRes.data ?? [];

    // ── Classify orders ────────────────────────────────────────────────────
    const allCreated = orders; // every order row = one checkout page hit
    const paid       = orders.filter((o) => o.status === "paid");

    // ── Conversion funnel ──────────────────────────────────────────────────
    // "clicked through to payment" = created an order (checkout opened)
    const checkoutStarts  = allCreated.length;
    const paidCount       = paid.length;
    const conversionRate  = checkoutStarts > 0
      ? Math.round((paidCount / checkoutStarts) * 100)
      : 0;

    // ── Revenue numbers (paise → rupees) ──────────────────────────────────
    const PAISE = 100;
    const totalRevenuePaise = paid.reduce((s, o) => s + ((o.amount as number) ?? 0), 0);
    const totalRevenue      = totalRevenuePaise / PAISE;

    const mrr = paid
      .filter((o) => new Date(o.paid_at as string) >= monthStart)
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const prevMrr = paid
      .filter((o) => {
        const d = new Date(o.paid_at as string);
        return d >= prevMonthStart && d < prevMonthEnd;
      })
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const arr = mrr * 12;
    const mrrGrowth = prevMrr > 0
      ? Math.round(((mrr - prevMrr) / prevMrr) * 100)
      : null;

    // ── Paying users (unique) ──────────────────────────────────────────────
    const uniquePayingUsers = new Set(paid.map((o) => o.user_id as string)).size;

    // Active passes (expires in the future)
    const activePasses = entitlements.filter(
      (e) => new Date(e.access_until as string) > now
    ).length;

    // Churned = paid but no active entitlement
    const payingUserIds  = new Set(paid.map((o) => o.user_id as string));
    const activeUserIds  = new Set(
      entitlements
        .filter((e) => new Date(e.access_until as string) > now)
        .map((e) => e.user_id as string)
    );
    const churnedCount = [...payingUserIds].filter((id) => !activeUserIds.has(id)).length;
    const churnRate    = uniquePayingUsers > 0
      ? Math.round((churnedCount / uniquePayingUsers) * 100)
      : 0;

    // LTV (simple: total revenue / unique paying users)
    const avgLtv = uniquePayingUsers > 0
      ? Math.round(totalRevenue / uniquePayingUsers)
      : 0;

    // ── Today & this week ──────────────────────────────────────────────────
    const revenueToday = paid
      .filter((o) => new Date(o.paid_at as string) >= todayStart)
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const checkoutToday = allCreated.filter(
      (o) => new Date(o.created_at as string) >= todayStart
    ).length;

    const paidToday = paid.filter(
      (o) => new Date(o.paid_at as string) >= todayStart
    ).length;

    // ── 30-day daily revenue timeseries ───────────────────────────────────
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    paid.forEach((o) => {
      const day = (o.paid_at as string | null)?.slice(0, 10);
      if (day && day in dailyMap) {
        dailyMap[day] += (o.amount as number) / PAISE;
      }
    });
    const revenueTimeseries = Object.entries(dailyMap).map(([date, revenue]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: Math.round(revenue),
    }));

    // ── 30-day daily checkout starts timeseries ────────────────────────────
    const checkoutMap: Record<string, number> = {};
    revenueTimeseries.forEach(({ date }) => { checkoutMap[date] = 0; });
    allCreated.forEach((o) => {
      const day = (o.created_at as string).slice(0, 10);
      if (day in checkoutMap) checkoutMap[day]++;
    });
    const checkoutTimeseries = Object.entries(checkoutMap).map(([date, count]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      count,
    }));

    // ── Recent paid orders (last 20) ───────────────────────────────────────
    const recentPaid = paid.slice(0, 20).map((o) => ({
      id:      (o.id as string).slice(0, 8),
      userId:  (o.user_id as string).slice(0, 8),
      amount:  (o.amount as number) / PAISE,
      paidAt:  o.paid_at as string,
    }));

    return Response.json({
      // Funnel
      checkoutStarts,
      paidCount,
      conversionRate,
      checkoutToday,
      paidToday,
      // Revenue
      totalRevenue:  Math.round(totalRevenue),
      mrr:           Math.round(mrr),
      prevMrr:       Math.round(prevMrr),
      arr:           Math.round(arr),
      mrrGrowth,
      revenueToday:  Math.round(revenueToday),
      // Users
      uniquePayingUsers,
      activePasses,
      churnedCount,
      churnRate,
      avgLtv,
      // Timeseries
      revenueTimeseries,
      checkoutTimeseries,
      // Recent
      recentPaid,
    });
  } catch (err) {
    console.error("[revenue]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign, TrendingUp, Users, CreditCard,
  BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Minus, ShoppingCart, CheckCircle, MousePointerClick,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface RevenueData {
  checkoutStarts:    number;
  paidCount:         number;
  conversionRate:    number;
  checkoutToday:     number;
  paidToday:         number;
  totalRevenue:      number;
  mrr:               number;
  prevMrr:           number;
  arr:               number;
  mrrGrowth:         number | null;
  revenueToday:      number;
  uniquePayingUsers: number;
  activePasses:      number;
  churnedCount:      number;
  churnRate:         number;
  avgLtv:            number;
  revenueTimeseries:  { date: string; label: string; revenue: number }[];
  checkoutTimeseries: { date: string; label: string; count: number }[];
  recentPaid: { id: string; userId: string; amount: number; paidAt: string }[];
  error?: string;
}

const CARD = "bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, accent = "slate", growth, loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "emerald" | "indigo" | "violet" | "amber" | "slate" | "rose";
  growth?: number | null;
  loading?: boolean;
}) {
  const accentMap = {
    emerald: { bg: "bg-emerald-50", ring: "border-emerald-100", icon: "text-emerald-600" },
    indigo:  { bg: "bg-indigo-50",  ring: "border-indigo-100",  icon: "text-indigo-600"  },
    violet:  { bg: "bg-violet-50",  ring: "border-violet-100",  icon: "text-violet-600"  },
    amber:   { bg: "bg-amber-50",   ring: "border-amber-100",   icon: "text-amber-600"   },
    rose:    { bg: "bg-rose-50",    ring: "border-rose-100",    icon: "text-rose-600"    },
    slate:   { bg: "bg-slate-50",   ring: "border-slate-100",   icon: "text-slate-500"   },
  };
  const c = accentMap[accent];

  if (loading) {
    return (
      <div className={`${CARD} p-5`}>
        <div className="shimmer h-4 w-24 rounded mb-3" />
        <div className="shimmer h-8 w-20 rounded mb-2" />
        <div className="shimmer h-3 w-32 rounded" />
      </div>
    );
  }

  const GrowthIcon = growth == null ? Minus : growth > 0 ? ArrowUpRight : ArrowDownRight;
  const growthColor = growth == null ? "text-slate-400" : growth > 0 ? "text-emerald-600" : "text-rose-500";

  return (
    <div className={`${CARD} p-5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border ${c.bg} ${c.ring} flex items-center justify-center`}>
          <Icon size={18} className={c.icon} strokeWidth={1.8} />
        </div>
        {growth !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${growthColor}`}>
            <GrowthIcon size={13} />
            {growth != null ? `${Math.abs(growth)}%` : "—"}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none tracking-tight">{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniBar({
  data, valueKey, color = "emerald", loading,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  color?: "emerald" | "indigo" | "violet";
  loading: boolean;
}) {
  const colorMap = {
    emerald: { active: "bg-emerald-500", rest: "bg-slate-100 group-hover:bg-slate-200" },
    indigo:  { active: "bg-indigo-500",  rest: "bg-slate-100 group-hover:bg-slate-200" },
    violet:  { active: "bg-violet-500",  rest: "bg-slate-100 group-hover:bg-slate-200" },
  };
  const cols = colorMap[color];

  if (loading) {
    return (
      <div className="flex items-end gap-[2px] h-16">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="flex-1 shimmer rounded-sm" style={{ height: `${15 + (i % 5) * 12}%` }} />
        ))}
      </div>
    );
  }

  const values = data.map((d) => (d[valueKey] as number) ?? 0);
  const max    = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d, i) => {
        const val  = (d[valueKey] as number) ?? 0;
        const pct  = Math.max((val / max) * 100, 1.5);
        const last = i === data.length - 1;
        return (
          <div key={i} className="flex-1 relative group cursor-default">
            <div className={`w-full rounded-sm transition-colors ${last ? cols.active : cols.rest}`} style={{ height: `${pct}%` }} />
            {val > 0 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                {valueKey === "revenue" ? fmt(val) : val}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────
function FunnelBar({ label, value, max, color, sub }: {
  label: string; value: number; max: number; color: string; sub?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          {sub && <span className="text-xs text-slate-400">{sub}</span>}
          <span className="text-sm font-bold text-slate-900">{value.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RevenuePage() {
  const [data,       setData]       = useState<RevenueData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch("/api/revenue", { cache: "no-store" });
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Revenue</h1>
            <p className="text-sm text-slate-500 mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-slate-400">
              Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {!loading && data?.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {data.error}
          </div>
        )}

        {/* ── Hero row: net revenue + today ── */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#001428] to-emerald-950 text-white shadow-[0_4px_32px_rgba(0,0,0,0.18)] p-6 sm:p-8">
          <div className="absolute inset-0 opacity-[0.2] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-16 -right-12 h-52 w-52 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-indigo-500" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">Net Revenue</p>
              {loading ? (
                <div className="shimmer h-12 w-40 rounded-lg" />
              ) : (
                <p className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
                  {fmt(data?.totalRevenue ?? 0)}
                </p>
              )}
              <p className="text-sm text-white/40 mt-2">All time · {data?.paidCount ?? 0} successful payments</p>
            </div>

            <div className="flex items-stretch gap-3 flex-wrap">
              {[
                { label: "Today",        value: loading ? "—" : fmt(data?.revenueToday ?? 0),      dim: false },
                { label: "This month",   value: loading ? "—" : fmt(data?.mrr ?? 0),               dim: false },
                { label: "Active passes",value: loading ? "—" : String(data?.activePasses ?? 0),   dim: false },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col justify-center items-center px-4 py-3 rounded-xl bg-white/[0.07] border border-white/[0.1] min-w-[96px]">
                  <span className="text-xl font-bold text-white leading-none">{value}</span>
                  <span className="text-[11px] text-white/40 mt-1 uppercase tracking-wide whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── KPI grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={MousePointerClick} label="Checkout starts"  value={loading ? "—" : (data?.checkoutStarts ?? 0).toLocaleString()} sub="Payment page opened"         accent="indigo"  loading={loading} />
          <StatCard icon={CheckCircle}       label="Paid customers"   value={loading ? "—" : (data?.uniquePayingUsers ?? 0).toLocaleString()} sub="Unique paying users"     accent="emerald" loading={loading} />
          <StatCard icon={ShoppingCart}      label="Conversion rate"  value={loading ? "—" : `${data?.conversionRate ?? 0}%`} sub="Checkout → paid"               accent={data?.conversionRate && data.conversionRate >= 30 ? "emerald" : "amber"} loading={loading} />
          <StatCard icon={TrendingUp}        label="MRR"              value={loading ? "—" : fmt(data?.mrr ?? 0)} sub="This month"                          accent="emerald" growth={data?.mrrGrowth ?? null} loading={loading} />
          <StatCard icon={DollarSign}        label="ARR (projected)"  value={loading ? "—" : fmt(data?.arr ?? 0)} sub="MRR × 12"                            accent="violet"  loading={loading} />
          <StatCard icon={CreditCard}        label="Avg LTV"          value={loading ? "—" : fmt(data?.avgLtv ?? 0)} sub="Revenue per student"              accent="indigo"  loading={loading} />
        </div>

        {/* ── Today row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={MousePointerClick} label="Checkouts today" value={loading ? "—" : (data?.checkoutToday ?? 0)} sub="Payment modal opened"           accent="indigo"  loading={loading} />
          <StatCard icon={CheckCircle}       label="Paid today"      value={loading ? "—" : (data?.paidToday ?? 0)}     sub="Successful today"               accent="emerald" loading={loading} />
          <StatCard icon={DollarSign}        label="Revenue today"   value={loading ? "—" : fmt(data?.revenueToday ?? 0)} sub="Captured today"               accent="emerald" loading={loading} />
          <StatCard icon={BarChart2}         label="Churn rate"      value={loading ? "—" : `${data?.churnRate ?? 0}%`} sub={`${data?.churnedCount ?? 0} lapsed`} accent={data?.churnRate && data.churnRate > 20 ? "rose" : "slate"} loading={loading} />
        </div>

        {/* ── Checkout funnel + revenue chart ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Conversion funnel */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart size={15} className="text-slate-400" strokeWidth={1.8} />
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">Payment Funnel</h2>
                <p className="text-xs text-slate-400 mt-0.5">From banner click to paid customer</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-5">
                {[1, 2, 3].map((i) => <div key={i} className="shimmer h-10 rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-5">
                <FunnelBar
                  label="Clicked through to payment"
                  value={data?.checkoutStarts ?? 0}
                  max={data?.checkoutStarts ?? 1}
                  color="bg-indigo-400"
                  sub="checkout opened"
                />
                <FunnelBar
                  label="Payment successful"
                  value={data?.paidCount ?? 0}
                  max={data?.checkoutStarts ?? 1}
                  color="bg-emerald-500"
                  sub={`${data?.conversionRate ?? 0}% conversion`}
                />
                <FunnelBar
                  label="Active pass holders"
                  value={data?.activePasses ?? 0}
                  max={data?.checkoutStarts ?? 1}
                  color="bg-violet-500"
                  sub="not expired"
                />

                {/* Conversion big number */}
                <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Overall conversion</span>
                  <span className={`text-lg font-black ${
                    (data?.conversionRate ?? 0) >= 40 ? "text-emerald-600"
                    : (data?.conversionRate ?? 0) >= 20 ? "text-amber-600"
                    : "text-slate-400"
                  }`}>
                    {data?.conversionRate ?? 0}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Revenue chart */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={15} className="text-slate-400" strokeWidth={1.8} />
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">Daily Revenue — 30 days</h2>
                <p className="text-xs text-slate-400 mt-0.5">Captured payments per day</p>
              </div>
            </div>
            <div className="mt-4">
              <MiniBar data={data?.revenueTimeseries ?? []} valueKey="revenue" color="emerald" loading={loading} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
              <span>{data?.revenueTimeseries?.[0]?.label ?? "30 days ago"}</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* ── Checkout starts chart + recent paid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Checkout starts timeseries */}
          <div className={`${CARD} p-5`}>
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick size={15} className="text-slate-400" strokeWidth={1.8} />
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">Daily Checkout Starts — 30 days</h2>
                <p className="text-xs text-slate-400 mt-0.5">Payment page opens per day</p>
              </div>
            </div>
            <div className="mt-4">
              <MiniBar data={data?.checkoutTimeseries ?? []} valueKey="count" color="indigo" loading={loading} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
              <span>{data?.checkoutTimeseries?.[0]?.label ?? "30 days ago"}</span>
              <span>Today</span>
            </div>
          </div>

          {/* Recent payments */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle size={15} className="text-slate-400" strokeWidth={1.8} />
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">Recent Payments</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last 20 successful orders</p>
              </div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="shimmer h-3 w-16 rounded" />
                    <div className="shimmer h-3 flex-1 rounded" />
                    <div className="shimmer h-3 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : (data?.recentPaid ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <DollarSign size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No payments yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                {(data?.recentPaid ?? []).map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle size={13} className="text-emerald-600" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-500 truncate">#{p.id}…</p>
                      <p className="text-[11px] text-slate-400">{timeAgo(p.paidAt)}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between text-xs text-slate-400 pb-4 pt-2 border-t border-slate-200">
          <span>Live data from Supabase · auto-refreshes every 60 s</span>
          <a
            href="/api/export?type=revenue"
            download="rookie-revenue.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </a>
        </footer>

      </main>
    </div>
  );
}

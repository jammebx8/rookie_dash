"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, TrendingUp, Users, CreditCard,
  BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Minus, ShoppingCart, CheckCircle, MousePointerClick, Crown,
  Clock, HelpCircle, FileText, Sparkles, Search, Filter, AlertCircle, Eye, Zap,
  X, Tag, Key,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ConvertedUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  signupAt: string;
  paidAt: string;
  daysToConvert: number;
  questionsBeforePaying: number;
  testsBeforePaying: number;
  triggerFeature: string;
  amount: number;
  planId: string;
}

export interface MultiCheckoutUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  checkoutCount: number;
  isPaid: boolean;
  status: "paid" | "abandoned";
  planId: string;
  lastCheckoutAt: string;
  currentPrice?: number;
  saleType?: "custom" | "welcome" | "none";
  saleHoursLeft?: number;
  saleExpiresAt?: string | null;
}

export interface CheckoutDirectoryUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  checkoutCount: number;
  isPaid: boolean;
  status: "paid" | "abandoned";
  planId: string;
  lastCheckoutAt: string;
  lastAmount: number;
  currentPrice?: number;
  saleType?: "custom" | "welcome" | "none";
  saleHoursLeft?: number;
  saleExpiresAt?: string | null;
}

export interface CheckoutEvent {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  planId: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  userCheckoutCount: number;
  isPaidUser: boolean;
}

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
  recentPaid: {
    id: string;
    userId: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    amount: number;
    paidAt: string;
    planId?: string;
  }[];
  freeToPaidConversion?: {
    totalConvertedUsers: number;
    avgDaysToConvert: number;
    medianDaysToConvert: number;
    avgQuestionsBefore: number;
    avgTestsBefore: number;
    daysBuckets: { label: string; count: number; pct: number }[];
    convertedUsers: ConvertedUser[];
  };
  multipleCheckoutOpeners?: {
    totalMultiOpeners: number;
    convertedCount: number;
    abandonedCount: number;
    users: MultiCheckoutUser[];
  };
  checkoutDirectory?: {
    totalCheckouts: number;
    totalUsers: number;
    singleClickUsersCount: number;
    multiClickUsersCount: number;
    convertedCount: number;
    abandonedCount: number;
    users: CheckoutDirectoryUser[];
    allEvents: CheckoutEvent[];
  };
  error?: string;
}

const CARD = "bg-white dark:bg-[#1b1e22] rounded-[16px] border border-[#ecebe8] dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

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

function getInitials(name: string, email: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) return email.slice(0, 2).toUpperCase();
  return "U";
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

  // ── Checkout directory filters & search ──────────────────────────────────
  const [checkoutFilter, setCheckoutFilter] = useState<"all" | "single" | "multi" | "paid" | "abandoned">("all");
  const [checkoutView, setCheckoutView] = useState<"users" | "events">("users");
  const [checkoutSearch, setCheckoutSearch] = useState<string>("");

  // ── Custom sale modal state ───────────────────────────────────────────────
  const [saleTarget, setSaleTarget] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [salePrice, setSalePrice] = useState("399");
  const [saleHours, setSaleHours] = useState("24");
  const [saleReason, setSaleReason] = useState("");
  const [salePassword, setSalePassword] = useState("");
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleToast, setSaleToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openSaleModal = (userId: string, name: string, email: string) => {
    setSaleTarget({ userId, name, email });
    setSalePrice("399");
    setSaleHours("24");
    setSaleReason("");
    setSalePassword("");
    setSaleToast(null);
  };

  const handleGrantSale = async () => {
    if (!saleTarget) return;
    if (!salePassword.trim()) {
      setSaleToast({ type: "error", text: "Please enter the admin password." });
      return;
    }
    setSaleSubmitting(true);
    setSaleToast(null);
    try {
      const res = await fetch("/api/custom-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: saleTarget.userId,
          customPrice: Number(salePrice),
          durationHours: Number(saleHours),
          adminPassword: salePassword,
          reason: saleReason || `Revenue lead discount: ₹${salePrice} for ${saleHours}h`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaleToast({ type: "error", text: json.error || "Failed to activate custom sale" });
      } else {
        setSaleToast({
          type: "success",
          text: `🎉 Sale active! ₹${salePrice} for ${saleHours}h granted to ${saleTarget.name || saleTarget.email}.`,
        });
        setTimeout(() => {
          setSaleTarget(null);
          fetchData(true);
        }, 1200);
      }
    } catch (err) {
      setSaleToast({ type: "error", text: String(err) });
    } finally {
      setSaleSubmitting(false);
    }
  };

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

  const filteredCheckoutUsers = (data?.checkoutDirectory?.users ?? []).filter((u) => {
    if (checkoutSearch.trim()) {
      const q = checkoutSearch.toLowerCase();
      const match = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (checkoutFilter === "single") return u.checkoutCount === 1;
    if (checkoutFilter === "multi") return u.checkoutCount > 1;
    if (checkoutFilter === "paid") return u.isPaid;
    if (checkoutFilter === "abandoned") return !u.isPaid;
    return true;
  });

  const filteredCheckoutEvents = (data?.checkoutDirectory?.allEvents ?? []).filter((e) => {
    if (checkoutSearch.trim()) {
      const q = checkoutSearch.toLowerCase();
      const match = e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.userId.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (checkoutFilter === "single") return e.userCheckoutCount === 1;
    if (checkoutFilter === "multi") return e.userCheckoutCount > 1;
    if (checkoutFilter === "paid") return e.status === "paid" || e.isPaidUser;
    if (checkoutFilter === "abandoned") return e.status !== "paid" && !e.isPaidUser;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8f8f7] dark:bg-[#121417] text-[#2e2e2e] dark:text-[#f3f5fa]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#2e2e2e] dark:text-[#f3f5fa]">Revenue &amp; Conversions</h1>
            <p className="text-xs text-[#736d68] dark:text-[#868c97] mt-1">{today}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <span className="text-xs text-[#736d68] dark:text-[#868c97]">
              Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Link
              href="/grant-pass"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#178a51] hover:text-[#0d3d28] bg-[#dcf5e7] hover:bg-[#b6eacd] dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/80 px-3 py-1.5 rounded-[8px] transition"
            >
              <Crown size={13} className="text-[#fdba12] fill-[#fdba12]" />
              Grant Pass
            </Link>
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
                <p className="text-xs text-slate-400 mt-0.5">From checkout open to paid customer</p>
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
                      <Link href={`/users/${p.userId}`} className="text-xs font-semibold text-slate-800 truncate hover:text-indigo-600 hover:underline block">
                        {p.name || `#${p.id}…`}
                      </Link>
                      <p className="text-[11px] text-slate-400">{p.email ? `${p.email} · ` : ""}{timeAgo(p.paidAt)}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION — Free-to-Paid Conversion Analysis (Item 9)
            Time/days to convert, questions & tests solved pre-payment,
            and what made them pay
        ══════════════════════════════════════════════════════════════════ */}
        <section className={`${CARD} p-6 space-y-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900">
                  Free-to-Paid Conversion Journey
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Time from signup to payment, questions & tests solved before paying, and trigger topics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                {data?.freeToPaidConversion?.totalConvertedUsers ?? 0} converted customers
              </span>
            </div>
          </div>

          {/* 4 Conversion Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Clock size={13} className="text-indigo-500" />
                <span>Avg Days to Convert</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {loading ? "—" : `${data?.freeToPaidConversion?.avgDaysToConvert ?? 0}d`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Signup → first payment</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Clock size={13} className="text-sky-500" />
                <span>Median Days</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {loading ? "—" : `${data?.freeToPaidConversion?.medianDaysToConvert ?? 0}d`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">50th percentile student</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <HelpCircle size={13} className="text-amber-500" />
                <span>Pre-Pay Questions</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {loading ? "—" : (data?.freeToPaidConversion?.avgQuestionsBefore ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Avg solved before purchase</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <FileText size={13} className="text-violet-500" />
                <span>Pre-Pay Custom Tests</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {loading ? "—" : `${data?.freeToPaidConversion?.avgTestsBefore ?? 0}`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Avg tests attempted before paying</p>
            </div>
          </div>

          {/* Time-to-Convert Distribution */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Time to Convert Distribution
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {(data?.freeToPaidConversion?.daysBuckets ?? []).map((b) => (
                <div key={b.label} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{b.label}</span>
                    <span className="font-bold text-slate-900">{b.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">{b.pct}% of paid</span>
                </div>
              ))}
            </div>
          </div>

          {/* Converted Users Table */}
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              Converted Customers & What Made Them Pay
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold">Days to Pay</th>
                    <th className="px-3 py-3 font-semibold">Pre-Pay Questions</th>
                    <th className="px-3 py-3 font-semibold">Pre-Pay Tests</th>
                    <th className="px-3 py-3 font-semibold">Likely Purchase Trigger</th>
                    <th className="px-3 py-3 font-semibold">Plan & Paid</th>
                    <th className="px-3 py-3 font-semibold text-right">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading conversion data…
                      </td>
                    </tr>
                  ) : (data?.freeToPaidConversion?.convertedUsers ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No converted customers found yet
                      </td>
                    </tr>
                  ) : (
                    (data?.freeToPaidConversion?.convertedUsers ?? []).map((u) => (
                      <tr key={u.userId} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name}
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {getInitials(u.name, u.email)}
                              </div>
                            )}
                            <div className="min-w-0 max-w-[160px]">
                              <Link
                                href={`/users/${u.userId}`}
                                className="font-semibold text-slate-800 truncate hover:text-indigo-600 hover:underline block"
                              >
                                {u.name}
                              </Link>
                              <p className="text-[11px] text-slate-400 truncate">{u.email || u.userId.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            u.daysToConvert <= 1
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : u.daysToConvert <= 7
                              ? "bg-sky-50 text-sky-700 border-sky-100"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {u.daysToConvert < 1 ? "< 24 hrs" : `${u.daysToConvert} days`}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-800 tabular-nums">
                            {u.questionsBeforePaying} Qs
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-medium text-slate-600 tabular-nums">
                            {u.testsBeforePaying} tests
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block max-w-[200px] truncate text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium" title={u.triggerFeature}>
                            {u.triggerFeature}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-900">₹{u.amount}</span>
                          <span className="block text-[10px] text-slate-400 truncate max-w-[100px]">{u.planId}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">
                          {new Date(u.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION — All Checkout Sessions & Purchase Intent Directory
            Shows all list of checkouts happened arranged as most recent first,
            data like clicked 1 time or 2 times etc., and list of users with
            links to individual student profiles.
        ══════════════════════════════════════════════════════════════════ */}
        <section className={`${CARD} p-6 space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart size={18} className="text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">
                  All Checkouts & Purchase Intent Directory
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Arranged as most recent first · shows all checkout clicks (1 time, 2+ times) and users with links to inspect individual profiles
              </p>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setCheckoutView("users")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  checkoutView === "users"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                By Student ({data?.checkoutDirectory?.totalUsers ?? 0})
              </button>
              <button
                onClick={() => setCheckoutView("events")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  checkoutView === "events"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Live Feed ({data?.checkoutDirectory?.totalCheckouts ?? 0} Checkouts)
              </button>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80">
              <span className="text-[11px] font-medium text-slate-500 block">Total Checkouts</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.totalCheckouts ?? 0)}</p>
              <span className="text-[10px] text-slate-400">modal opened</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80">
              <span className="text-[11px] font-medium text-slate-500 block">Unique Shoppers</span>
              <p className="text-lg font-bold text-indigo-700 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.totalUsers ?? 0)}</p>
              <span className="text-[10px] text-slate-400">students</span>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80">
              <span className="text-[11px] font-medium text-slate-500 block">Clicked 1 Time</span>
              <p className="text-lg font-bold text-slate-700 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.singleClickUsersCount ?? 0)}</p>
              <span className="text-[10px] text-slate-400">first-time interest</span>
            </div>
            <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50">
              <span className="text-[11px] font-medium text-indigo-700 block">Clicked 2+ Times</span>
              <p className="text-lg font-bold text-indigo-900 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.multiClickUsersCount ?? 0)}</p>
              <span className="text-[10px] text-indigo-500 font-medium">high purchase intent</span>
            </div>
            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
              <span className="text-[11px] font-medium text-emerald-700 block">Converted (Paid)</span>
              <p className="text-lg font-bold text-emerald-800 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.convertedCount ?? 0)}</p>
              <span className="text-[10px] text-emerald-600 font-medium">active pass holders</span>
            </div>
            <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/50">
              <span className="text-[11px] font-medium text-amber-700 block">Abandoned Leads</span>
              <p className="text-lg font-bold text-amber-800 mt-0.5">{loading ? "—" : (data?.checkoutDirectory?.abandonedCount ?? 0)}</p>
              <span className="text-[10px] text-amber-600 font-medium">follow-up pipeline</span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
                <Filter size={12} /> Filter:
              </span>
              {(
                [
                  { id: "all", label: `All (${checkoutView === "users" ? (data?.checkoutDirectory?.totalUsers ?? 0) : (data?.checkoutDirectory?.totalCheckouts ?? 0)})` },
                  { id: "single", label: `Clicked 1 Time (${data?.checkoutDirectory?.singleClickUsersCount ?? 0})` },
                  { id: "multi", label: `Clicked 2+ Times (${data?.checkoutDirectory?.multiClickUsersCount ?? 0})` },
                  { id: "paid", label: `Paid Customers (${data?.checkoutDirectory?.convertedCount ?? 0})` },
                  { id: "abandoned", label: `Abandoned Leads (${data?.checkoutDirectory?.abandonedCount ?? 0})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCheckoutFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                    checkoutFilter === tab.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative shrink-0 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={checkoutView === "users" ? "Search student name or email…" : "Search name, email, or order ID…"}
                value={checkoutSearch}
                onChange={(e) => setCheckoutSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {checkoutSearch && (
                <button
                  onClick={() => setCheckoutSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Table / Mobile Cards */}
          {checkoutView === "users" ? (
            <>
              {/* Mobile Card View (< sm) */}
              <div className="sm:hidden divide-y divide-[#ecebe8] dark:divide-white/10 border-t border-[#ecebe8] dark:border-white/10">
                {loading ? (
                  <p className="px-4 py-8 text-center text-[#736d68] dark:text-[#868c97] text-xs">
                    Loading checkout directory…
                  </p>
                ) : filteredCheckoutUsers.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[#736d68] dark:text-[#868c97] text-xs">
                    No students match the current filter or search
                  </p>
                ) : (
                  filteredCheckoutUsers.map((u) => (
                    <div key={u.userId} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#ecebe8] dark:border-white/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1F75FE] to-[#14593a] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(u.name, u.email)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/users/${u.userId}`}
                              className="font-semibold text-[13px] text-[#2e2e2e] dark:text-[#f3f5fa] truncate block"
                            >
                              {u.name}
                            </Link>
                            <p className="text-[11px] text-[#736d68] dark:text-[#868c97] truncate">{u.email || u.userId.slice(0, 8)}</p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-bold shrink-0 ${
                            u.checkoutCount >= 2
                              ? "bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300"
                              : "bg-[#f1f1ef] text-[#55514e] dark:bg-white/10 dark:text-[#b6bbc5]"
                          }`}
                        >
                          {u.checkoutCount}× opened
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <div>
                          {u.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] font-bold text-[10px] bg-[#dcf5e7] text-[#178a51] dark:bg-emerald-950/70 dark:text-emerald-300">
                              <Crown size={10} className="text-[#fdba12] fill-[#fdba12]" /> Paid Pass
                            </span>
                          ) : u.saleType === "custom" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] font-bold text-[10px] bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300">
                              <Sparkles size={10} /> ₹{u.currentPrice} ({u.saleHoursLeft}h left)
                            </span>
                          ) : u.saleType === "welcome" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] font-bold text-[10px] bg-[#e3f1ff] text-[#2a6fb5] dark:bg-sky-950/70 dark:text-sky-300">
                              <Clock size={10} /> ₹399 (60% OFF · {u.saleHoursLeft}h left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] font-medium text-[10px] bg-[#f1f1ef] text-[#55514e] dark:bg-white/10 dark:text-[#b6bbc5]">
                              ₹999 (Sale Expired)
                            </span>
                          )}
                        </div>
                        <span className="text-[#736d68] dark:text-[#868c97]">{timeAgo(u.lastCheckoutAt)}</span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#ecebe8]/60 dark:border-white/5">
                        {!u.isPaid && (
                          <button
                            type="button"
                            onClick={() => openSaleModal(u.userId, u.name, u.email)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold bg-[#fff1f4] text-[#ff4f7b] border border-[#f7cdc8] dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900"
                          >
                            <Zap size={11} className="fill-current" />
                            ⚡ Put on Sale
                          </button>
                        )}
                        <Link
                          href={`/users/${u.userId}`}
                          className="px-2.5 py-1 rounded-[8px] text-[11px] font-semibold bg-[#e3f1ff] text-[#1d4f86] dark:bg-sky-950/70 dark:text-sky-300"
                        >
                          Profile →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View (≥ sm) */}
              <div className="hidden sm:block overflow-x-auto rounded-[12px] border border-[#ecebe8] dark:border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f8f7] dark:bg-[#16181c] border-b border-[#ecebe8] dark:border-white/10 text-[#736d68] dark:text-[#868c97] uppercase tracking-wider text-[10px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-3 py-3 text-center">Times Opened</th>
                      <th className="px-3 py-3">Purchase Status</th>
                      <th className="px-3 py-3">Current Price &amp; Sale Status</th>
                      <th className="px-3 py-3">Target Plan</th>
                      <th className="px-3 py-3 text-right">Last Checkout</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ecebe8] dark:divide-white/10 bg-white dark:bg-[#1b1e22]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#736d68] dark:text-[#868c97]">
                          Loading checkout directory…
                        </td>
                      </tr>
                    ) : filteredCheckoutUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#736d68] dark:text-[#868c97]">
                          No students match the current filter or search
                        </td>
                      </tr>
                    ) : (
                      filteredCheckoutUsers.map((u) => (
                        <tr key={u.userId} className="hover:bg-[#f8f8f7]/80 dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {u.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.avatarUrl}
                                  alt={u.name}
                                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#ecebe8] dark:border-white/10"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1F75FE] to-[#14593a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {getInitials(u.name, u.email)}
                                </div>
                              )}
                              <div className="min-w-0 max-w-[200px]">
                                <Link
                                  href={`/users/${u.userId}`}
                                  className="font-semibold text-[#2e2e2e] dark:text-[#f3f5fa] truncate hover:text-[#2a6fb5] dark:hover:text-sky-300 block transition-colors"
                                >
                                  {u.name}
                                </Link>
                                <p className="text-[11px] text-[#736d68] dark:text-[#868c97] truncate">{u.email || u.userId.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-[11px] font-bold ${
                                u.checkoutCount >= 6
                                  ? "bg-[#fff1f4] text-[#ff4f7b] border border-[#f7cdc8] dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/40"
                                  : u.checkoutCount >= 3
                                  ? "bg-[#e3f1ff] text-[#1d4f86] border border-[#c9e5ff] dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800/40"
                                  : u.checkoutCount === 2
                                  ? "bg-[#e3f1ff] text-[#2a6fb5] border border-[#c9e5ff] dark:bg-sky-950/50 dark:text-sky-400"
                                  : "bg-[#f1f1ef] text-[#55514e] border border-[#ecebe8] dark:bg-white/10 dark:text-[#b6bbc5] dark:border-white/10"
                              }`}
                            >
                              {u.checkoutCount}× {u.checkoutCount === 1 ? "clicked" : "opened"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {u.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#dcf5e7] text-[#178a51] dark:bg-emerald-950/70 dark:text-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                                Paid Customer
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#fff3c4] text-[#6b4a00] dark:bg-amber-950/70 dark:text-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                                Abandoned Lead
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {u.isPaid ? (
                              <span className="text-[11px] font-semibold text-[#178a51] dark:text-emerald-400">
                                Active Subscription
                              </span>
                            ) : u.saleType === "custom" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] font-bold text-[10px] bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300 w-fit">
                                  <Sparkles size={10} /> ₹{u.currentPrice} (Custom)
                                </span>
                                <span className="text-[10px] text-[#ff4f7b] dark:text-rose-400 font-medium">⚡ {u.saleHoursLeft}h left</span>
                              </div>
                            ) : u.saleType === "welcome" ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] font-bold text-[10px] bg-[#e3f1ff] text-[#2a6fb5] dark:bg-sky-950/70 dark:text-sky-300 w-fit">
                                  <Clock size={10} /> ₹399 (60% OFF)
                                </span>
                                <span className="text-[10px] text-[#2a6fb5] dark:text-sky-400 font-medium">⏱️ {u.saleHoursLeft}h left</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] font-medium text-[10px] bg-[#f1f1ef] text-[#55514e] dark:bg-white/10 dark:text-[#b6bbc5] w-fit">
                                  ₹999 (Standard Base)
                                </span>
                                <span className="text-[10px] text-[#736d68] dark:text-[#868c97]">Sale expired</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-semibold text-[#2e2e2e] dark:text-[#f3f5fa]">₹{u.lastAmount || 399}</span>
                            <span className="block text-[10px] text-[#736d68] dark:text-[#868c97] font-mono truncate max-w-[150px]">
                              {u.planId}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-[#736d68] dark:text-[#868c97] whitespace-nowrap">
                            <span className="font-medium text-[#2e2e2e] dark:text-[#f3f5fa] block">{timeAgo(u.lastCheckoutAt)}</span>
                            <span className="text-[10px] text-[#736d68] dark:text-[#868c97]">
                              {new Date(u.lastCheckoutAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!u.isPaid && (
                                <button
                                  type="button"
                                  onClick={() => openSaleModal(u.userId, u.name, u.email)}
                                  className="inline-flex items-center gap-1 font-semibold text-[#ff4f7b] bg-[#fff1f4] hover:bg-[#fdecea] dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 rounded-[6px] text-[10px] border border-[#f7cdc8] dark:border-rose-900 transition"
                                  title="Put this lead on custom sale"
                                >
                                  <Zap size={10} className="fill-current text-[#ff4f7b]" />
                                  ⚡ Put on Sale
                                </button>
                              )}
                              <Link
                                href={`/users/${u.userId}`}
                                className="inline-flex items-center gap-1 font-semibold text-[#2a6fb5] hover:text-[#1d4f86] dark:text-sky-400 dark:hover:text-sky-300 text-xs transition-colors"
                              >
                                Profile →
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/70 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Time (Recent First)</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-3 py-3 font-semibold text-center">User Intent</th>
                    <th className="px-3 py-3 font-semibold">Amount & Plan</th>
                    <th className="px-3 py-3 font-semibold">Order Status</th>
                    <th className="px-3 py-3 font-semibold font-mono">Order ID</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading checkout events…
                      </td>
                    </tr>
                  ) : filteredCheckoutEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No checkout events match the current filter or search
                      </td>
                    </tr>
                  ) : (
                    filteredCheckoutEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 block">{timeAgo(e.createdAt)}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(e.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {e.avatarUrl ? (
                              <img
                                src={e.avatarUrl}
                                alt={e.name}
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {getInitials(e.name, e.email)}
                              </div>
                            )}
                            <div className="min-w-0 max-w-[180px]">
                              {e.userId ? (
                                <Link
                                  href={`/users/${e.userId}`}
                                  className="font-semibold text-slate-800 truncate hover:text-indigo-600 hover:underline block"
                                >
                                  {e.name}
                                </Link>
                              ) : (
                                <p className="font-semibold text-slate-800 truncate">{e.name}</p>
                              )}
                              <p className="text-[11px] text-slate-400 truncate">{e.email || (e.userId ? e.userId.slice(0, 8) : "—")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.userCheckoutCount > 1
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {e.userCheckoutCount}× Total Clicks
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-900">₹{e.amount}</span>
                          <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            {e.planId}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {e.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Created (Abandoned)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                          {e.id.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.userId && (
                            <Link
                              href={`/users/${e.userId}`}
                              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-xs"
                            >
                              Inspect →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

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

        {/* ── Custom Sale Modal ── */}
        {saleTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1b1e22] rounded-[16px] border border-[#ecebe8] dark:border-white/10 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-[8px] bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300">
                    <Zap size={18} className="fill-current" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#1a1918] dark:text-white">Put User on Custom Sale</h3>
                    <p className="text-xs text-[#736d68] dark:text-[#868c97]">Provide direct discount to this checkout lead</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaleTarget(null)}
                  className="p-1 rounded-[6px] text-[#736d68] hover:bg-[#f1f1ef] dark:text-[#868c97] dark:hover:bg-white/10 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User target card */}
              <div className="p-3 rounded-[12px] bg-[#f8f8f7] dark:bg-white/5 border border-[#ecebe8] dark:border-white/10 text-xs space-y-1">
                <div className="font-semibold text-[#1a1918] dark:text-white">{saleTarget.name || "Student"}</div>
                <div className="text-[#736d68] dark:text-[#868c97] font-mono text-[11px]">{saleTarget.email}</div>
                <div className="text-[10px] text-[#a8a39d] font-mono truncate">{saleTarget.userId}</div>
              </div>

              {/* Price selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1a1918] dark:text-white mb-1.5">
                  Sale Price for Rookie Pass Yearly (₹)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {["299", "399", "499", "599"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSalePrice(p)}
                      className={`h-9 rounded-[8px] text-xs font-bold transition border ${
                        salePrice === p
                          ? "bg-[#ff4f7b] text-white border-[#ff4f7b] shadow-sm"
                          : "bg-white dark:bg-white/5 text-[#2e2e2e] dark:text-white border-[#ecebe8] dark:border-white/10 hover:bg-[#f8f8f7]"
                      }`}
                    >
                      ₹{p}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="Or enter custom price (e.g. 349)"
                  className="w-full h-10 px-3 rounded-[8px] text-xs border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-[#1a1918] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ff4f7b]/40 font-mono"
                />
              </div>

              {/* Duration selector */}
              <div>
                <label className="block text-xs font-semibold text-[#1a1918] dark:text-white mb-1.5">
                  Sale Duration (Hours)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "12h", hours: "12" },
                    { label: "24h (1d)", hours: "24" },
                    { label: "48h (2d)", hours: "48" },
                    { label: "72h (3d)", hours: "72" },
                  ].map((d) => (
                    <button
                      key={d.hours}
                      type="button"
                      onClick={() => setSaleHours(d.hours)}
                      className={`h-9 rounded-[8px] text-xs font-bold transition border ${
                        saleHours === d.hours
                          ? "bg-[#1F75FE] text-white border-[#1F75FE] shadow-sm"
                          : "bg-white dark:bg-white/5 text-[#2e2e2e] dark:text-white border-[#ecebe8] dark:border-white/10 hover:bg-[#f8f8f7]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin Password */}
              <div>
                <label className="block text-xs font-semibold text-[#1a1918] dark:text-white mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-3 text-[#a8a39d]" />
                  <input
                    type="password"
                    value={salePassword}
                    onChange={(e) => setSalePassword(e.target.value)}
                    placeholder="Enter dashboard admin password"
                    className="w-full h-10 pl-9 pr-3 rounded-[8px] text-xs border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-[#1a1918] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ff4f7b]/40"
                  />
                </div>
              </div>

              {saleToast && (
                <div
                  className={`p-3 rounded-[8px] text-xs font-medium flex items-center gap-2 ${
                    saleToast.type === "success"
                      ? "bg-[#dcf5e7] text-[#178a51] dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300"
                  }`}
                >
                  <AlertCircle size={14} />
                  <span>{saleToast.text}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ecebe8] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setSaleTarget(null)}
                  disabled={saleSubmitting}
                  className="px-4 h-9 rounded-[8px] text-xs font-medium text-[#736d68] hover:bg-[#f1f1ef] dark:text-[#868c97] dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGrantSale}
                  disabled={saleSubmitting}
                  className="px-4 h-9 rounded-[8px] text-xs font-bold bg-[#ff4f7b] hover:bg-[#e03d67] text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {saleSubmitting ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Zap size={12} className="fill-current" />
                      Activate ₹{salePrice} Sale ({saleHours}h)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

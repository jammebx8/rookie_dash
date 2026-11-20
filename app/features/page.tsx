"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen, ClipboardList, Layers, RefreshCw, Target, Repeat,
  TrendingUp, TrendingDown,
} from "lucide-react";
import type { FeaturesData } from "@/app/api/features/route";

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD = "bg-white dark:bg-[#1b1e22] rounded-[16px] border border-[#ecebe8] dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
const SHIM = "shimmer rounded";

// ─── Feature definitions ──────────────────────────────────────────────────────
// Only the 4 surfaces that actually produce question attempts in Rookie.

const FEATURES: {
  key:     string;
  label:   string;
  desc:    string;
  bar:     string;        // Tailwind bg class for bar fill
  dot:     string;        // Tailwind bg class for legend dot
  badge:   string;        // Tailwind classes for the badge chip
}[] = [
  {
    key:   "daily_practice",
    label: "Daily Practice",
    desc:  "Personalized 5-question daily habit set on Home",
    bar:   "bg-amber-500",
    dot:   "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-100",
  },
  {
    key:   "question_viewer",
    label: "Question Viewer (Unrestricted)",
    desc:  "Unlimited AI solutions & questions across all JEE chapters",
    bar:   "bg-indigo-500",
    dot:   "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    key:   "similar",
    label: "Similar Questions (Free)",
    desc:  "Vector-matched questions shown below every Q in the viewer",
    bar:   "bg-sky-500",
    dot:   "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-100",
  },
  {
    key:   "practice",
    label: "Recommendation (Practice)",
    desc:  "Adaptive feed on the Practice page — driven by the ability vector",
    bar:   "bg-emerald-500",
    dot:   "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    key:   "custom_test",
    label: "Custom Test",
    desc:  "Questions attempted inside a timed custom test session",
    bar:   "bg-violet-500",
    dot:   "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-100",
  },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${SHIM} h-10 w-full`} />
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, icon: Icon }: {
  title: string; sub?: string; icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} className="text-slate-400" strokeWidth={1.8} />
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">
          {title}
        </h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────
function FunnelBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-800 tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Retention summary (pulled from /api/retention for policy impact) ─────────
interface RetentionSummary {
  monthlyRetention: number;
  repeatPlatformUsage?: {
    totalUsers: number;
    repeatUsersCount: number;
    repeatRate: number;
    distribution: { label: string; days: string | number; count: number; pct: number }[];
  };
  neverReturnedAfterUsing?: {
    total: number;
    neverReturnedCount: number;
    neverReturnedPct: number;
    returnedCount: number;
    returnedPct: number;
  };
  error?: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [data,        setData]        = useState<FeaturesData | null>(null);
  const [retention,   setRetention]   = useState<RetentionSummary | null>(null);
  const [segment,     setSegment]     = useState<"all" | "free" | "paid">("all");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async (targetSegment = segment, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [featRes, retRes] = await Promise.all([
        fetch(`/api/features?segment=${targetSegment}`, { cache: "no-store" }),
        fetch(`/api/retention?segment=${targetSegment}`, { cache: "no-store" }),
      ]);
      const [featJson, retJson] = await Promise.all([featRes.json(), retRes.json()]);
      setData(featJson);
      setRetention(retJson);
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [segment]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      setLoading(true);
      try {
        const [featRes, retRes] = await Promise.all([
          fetch(`/api/features?segment=${segment}`, { cache: "no-store" }),
          fetch(`/api/retention?segment=${segment}`, { cache: "no-store" }),
        ]);
        const [featJson, retJson] = await Promise.all([featRes.json(), retRes.json()]);
        if (!ignore) {
          setData(featJson);
          setRetention(retJson);
          setLastRefresh(new Date());
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    init();
    return () => { ignore = true; };
  }, [segment]);

  // ── Compute answered counts per feature ────────────────────────────────────
  const answeredByFeature = FEATURES.map(f => {
    const row = data?.feature_counts.find(
      fc => fc.feature === f.key && fc.event_name === "question_answered",
    );
    return { ...f, count: row?.event_count ?? 0, students: row?.unique_students ?? 0 };
  });

  const totalAnswered = answeredByFeature.reduce((s, r) => s + r.count, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Feature Usage</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Which features students use most & how free vs paid users engage
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Free vs Paid Segment Switch */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(["all", "free", "paid"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSegment(s);
                    fetchData(s, false);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                    segment === s
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {s === "all" ? "All Users" : s === "free" ? "Free Users" : "Paid Users"}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchData(segment, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {!loading && data?.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {data.error}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            IMPACT OVERVIEW — Free Question Viewer & Daily Practice
            Monitors usage, feature uplift & habit formation
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} p-6 border-amber-200/60 bg-gradient-to-br from-amber-50/40 via-white to-indigo-50/20`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  New Policy Impact: Free Viewer &amp; Daily Practice
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Did making solutions free and adding daily practice improve overall platform retention?
              </p>
            </div>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-200">
              Retention &amp; Habit
            </span>
          </div>

          {/* ── Row 1: Platform-wide retention signals ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Platform-wide retention (all features combined)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">

            {/* Monthly retention */}
            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Monthly Retention</p>
              {loading ? <div className="h-7 w-16 mt-1 shimmer rounded" /> : (
                <p className={`text-2xl font-black mt-1 tabular-nums ${
                  (retention?.monthlyRetention ?? 0) >= 30 ? "text-emerald-700" :
                  (retention?.monthlyRetention ?? 0) >= 15 ? "text-amber-700" : "text-rose-700"
                }`}>
                  {retention?.monthlyRetention ?? 0}%
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">users active last month → this month</p>
            </div>

            {/* Repeat usage rate */}
            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Multi-day Users</p>
              {loading ? <div className="h-7 w-16 mt-1 shimmer rounded" /> : (
                <p className={`text-2xl font-black mt-1 tabular-nums ${
                  (retention?.repeatPlatformUsage?.repeatRate ?? 0) >= 50 ? "text-emerald-700" :
                  (retention?.repeatPlatformUsage?.repeatRate ?? 0) >= 25 ? "text-amber-700" : "text-rose-700"
                }`}>
                  {retention?.repeatPlatformUsage?.repeatRate ?? 0}%
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {(retention?.repeatPlatformUsage?.repeatUsersCount ?? 0).toLocaleString()} of{" "}
                {(retention?.repeatPlatformUsage?.totalUsers ?? 0).toLocaleString()} users on 2+ days
              </p>
            </div>

            {/* 1-day bounce */}
            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">1-Day Bounce</p>
              {loading ? <div className="h-7 w-16 mt-1 shimmer rounded" /> : (() => {
                const d1 = retention?.repeatPlatformUsage?.distribution?.find(d => d.days === 1);
                const pct = d1?.pct ?? 0;
                return (
                  <p className={`text-2xl font-black mt-1 tabular-nums ${
                    pct <= 40 ? "text-emerald-700" : pct <= 60 ? "text-amber-700" : "text-rose-700"
                  }`}>
                    {pct}%
                  </p>
                );
              })()}
              <p className="text-[11px] text-slate-400 mt-1">users who never came back after day 1</p>
            </div>

            {/* Never returned after product use */}
            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Churned After 1 Use</p>
              {loading ? <div className="h-7 w-16 mt-1 shimmer rounded" /> : (
                <p className={`text-2xl font-black mt-1 tabular-nums ${
                  (retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0) <= 40 ? "text-emerald-700" :
                  (retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0) <= 60 ? "text-amber-700" : "text-rose-700"
                }`}>
                  {retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0}%
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {(retention?.neverReturnedAfterUsing?.neverReturnedCount ?? 0).toLocaleString()} of{" "}
                {(retention?.neverReturnedAfterUsing?.total ?? 0).toLocaleString()} users never returned
              </p>
            </div>
          </div>

          {/* ── Repeat usage distribution bar ── */}
          {!loading && (retention?.repeatPlatformUsage?.distribution ?? []).length > 0 && (() => {
            const dist = retention!.repeatPlatformUsage!.distribution;
            const colors = ["bg-rose-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-400", "bg-emerald-600"];
            return (
              <div className="mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  How many days do users come back? (all-time)
                </p>
                <div className="flex h-5 rounded-full overflow-hidden gap-[2px]">
                  {dist.map((bucket, i) => (
                    <div
                      key={bucket.label}
                      className={`${colors[i] ?? "bg-slate-300"} transition-all duration-700`}
                      style={{ width: `${Math.max(bucket.pct, bucket.count > 0 ? 2 : 0)}%` }}
                      title={`${bucket.label}: ${bucket.count.toLocaleString()} users (${bucket.pct}%)`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {dist.map((bucket, i) => (
                    <div key={bucket.label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${colors[i] ?? "bg-slate-300"}`} />
                      <span className="text-[11px] text-slate-600">{bucket.label}</span>
                      <span className="text-[10px] font-bold text-slate-500">{bucket.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Divider ── */}
          <div className="border-t border-amber-100 mb-5" />

          {/* ── Row 2: Feature-specific usage ── */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Feature adoption (last 30 days)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Daily Practice Users</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {loading ? "—" : (data?.impact_metrics?.dailyPractice.started_users ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                {(data?.impact_metrics?.dailyPractice.completed_users ?? 0).toLocaleString()} finished ({data?.impact_metrics?.dailyPractice.completion_rate ?? 0}%)
              </p>
            </div>

            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Daily Habit Repeat</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {loading ? "—" : `${data?.impact_metrics?.retentionImpact.daily_practice_repeat_rate ?? 0}%`}
              </p>
              <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                {(data?.impact_metrics?.retentionImpact.repeat_daily_practice_users ?? 0).toLocaleString()} back 2+ days
              </p>
            </div>

            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">AI Solutions Viewed</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1 tabular-nums">
                {loading ? "—" : (data?.impact_metrics?.questionViewer.solutions_viewed ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-indigo-600 mt-1 font-medium">free for all users</p>
            </div>

            <div className="bg-white/80 rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <p className="text-xs font-medium text-slate-400">Similar Qs Solved</p>
              <p className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">
                {loading ? "—" : (data?.impact_metrics?.questionViewer.similar_attempted ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-sky-600 mt-1 font-medium">concept reinforcement</p>
            </div>
          </div>

          {/* ── Verdict ── */}
          {!loading && retention && (() => {
            const repeatRate = retention.repeatPlatformUsage?.repeatRate ?? 0;
            const churnPct   = retention.neverReturnedAfterUsing?.neverReturnedPct ?? 0;
            const monthly    = retention.monthlyRetention ?? 0;
            const good = (repeatRate >= 40 ? 1 : 0) + (churnPct <= 55 ? 1 : 0) + (monthly >= 20 ? 1 : 0);
            const verdictColor = good >= 2 ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                               : good === 1 ? "border-amber-200 bg-amber-50/60 text-amber-800"
                               : "border-rose-200 bg-rose-50/60 text-rose-800";
            const icon = good >= 2 ? <TrendingUp size={13} className="shrink-0" /> : <TrendingDown size={13} className="shrink-0" />;
            const msg = good >= 2
              ? `Retention looks healthy — ${repeatRate}% multi-day repeat, ${monthly}% monthly retention, ${100 - churnPct}% of users came back after their first session.`
              : good === 1
              ? `Mixed signals — ${repeatRate}% repeat rate and ${monthly}% monthly retention. ${churnPct}% of users never returned after their first session, worth investigating.`
              : `Retention needs attention — only ${repeatRate}% repeat users, ${monthly}% monthly retention, and ${churnPct}% single-session churn.`;
            return (
              <div className={`flex items-start gap-2.5 mt-4 px-4 py-3 rounded-xl border text-xs font-medium ${verdictColor}`}>
                {icon}
                <span>{msg}</span>
              </div>
            );
          })()}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            EQUATION HINTS — Step-hover popup usage
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Equation Step Hints
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                How many students hover on equations to get a 2-line step explanation · last 30 days
              </p>
            </div>
            <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-full">
              equation_hint_used
            </span>
          </div>

          {loading ? (
            <Skeleton rows={2} />
          ) : (data?.impact_metrics?.equationHints.total_uses ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <p className="text-sm font-medium">No hint usage recorded yet</p>
              <p className="text-xs text-center max-w-xs leading-relaxed">
                Students trigger this by hovering any equation in a solution. Data will appear here once someone uses the feature.
              </p>
            </div>
          ) : (
            <>
              {/* Top-line stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                  <p className="text-xs font-medium text-slate-500">Total Uses</p>
                  <p className="text-2xl font-black text-violet-700 mt-1 tabular-nums">
                    {(data?.impact_metrics?.equationHints.total_uses ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">hint requests fired</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500">Unique Users</p>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                    {(data?.impact_metrics?.equationHints.unique_users ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">distinct students</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-medium text-slate-500">Repeat Users</p>
                  <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                    {(data?.impact_metrics?.equationHints.repeat_users ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">used on 2+ days</p>
                </div>

                <div className={`rounded-xl p-4 border ${
                  (data?.impact_metrics?.equationHints.repeat_rate ?? 0) >= 40
                    ? "bg-emerald-50 border-emerald-100"
                    : (data?.impact_metrics?.equationHints.repeat_rate ?? 0) >= 20
                    ? "bg-amber-50 border-amber-100"
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <p className="text-xs font-medium text-slate-500">Repeat Rate</p>
                  <p className={`text-2xl font-black mt-1 tabular-nums ${
                    (data?.impact_metrics?.equationHints.repeat_rate ?? 0) >= 40
                      ? "text-emerald-700"
                      : (data?.impact_metrics?.equationHints.repeat_rate ?? 0) >= 20
                      ? "text-amber-700"
                      : "text-slate-700"
                  }`}>
                    {data?.impact_metrics?.equationHints.repeat_rate ?? 0}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">came back 2+ days</p>
                </div>
              </div>

              {/* Per-feature breakdown */}
              {(data?.impact_metrics?.equationHints.by_feature ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Hints by feature surface
                  </p>
                  <div className="space-y-2.5">
                    {(data?.impact_metrics?.equationHints.by_feature ?? []).map((row) => {
                      const max = data?.impact_metrics?.equationHints.by_feature?.[0]?.count ?? 1;
                      const pct = max > 0 ? Math.round((row.count / max) * 100) : 0;
                      const meta = FEATURES.find(f => f.key === row.feature);
                      return (
                        <div key={row.feature}>
                          <div className="flex items-center justify-between mb-1 text-xs">
                            <div className="flex items-center gap-2">
                              {meta && <span className={`w-2 h-2 rounded-full ${meta.dot}`} />}
                              <span className="font-medium text-slate-700">
                                {meta?.label ?? row.feature.replace(/_/g, " ")}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 tabular-nums">
                              {row.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${meta?.bar ?? "bg-violet-500"}`}
                              style={{ width: `${Math.max(pct, row.count > 0 ? 2 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 — Questions Attempted by Feature
            The core answer: of all questions students answered, which
            surface sent them there?
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} p-6`}>

          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target size={15} className="text-slate-400" strokeWidth={1.8} />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Questions Attempted by Feature
                </h2>
              </div>
              <p className="text-xs text-slate-400 ml-[23px]">
                Last 30 days · only surfaces that produce question attempts
              </p>
            </div>
            <div className="text-right shrink-0">
              {loading ? (
                <div className={`${SHIM} h-9 w-20 animate-pulse`} />
              ) : (
                <>
                  <p className="text-3xl font-black text-slate-900 tabular-nums leading-none">
                    {totalAnswered.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">total attempts</p>
                </>
              )}
            </div>
          </div>

          {/* Bars */}
          {loading ? (
            <Skeleton rows={4} />
          ) : totalAnswered === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
              <Target size={32} strokeWidth={1.3} />
              <p className="text-sm font-medium">No attempts recorded yet</p>
              <p className="text-xs text-center max-w-sm leading-relaxed">
                Run <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">analytics_events_migration.sql</code> in
                Supabase then use the app. Question attempts will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {answeredByFeature
                .slice()
                .sort((a, b) => b.count - a.count)
                .map(row => {
                  const pct = totalAnswered > 0
                    ? Math.round((row.count / totalAnswered) * 100)
                    : 0;
                  return (
                    <div key={row.key}>
                      {/* Label row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-800">{row.label}</span>
                            <span className="hidden sm:inline text-xs text-slate-400 ml-2">{row.desc}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 ml-4">
                          <span className="text-xs text-slate-400 tabular-nums">
                            {row.students.toLocaleString()} student{row.students !== 1 ? "s" : ""}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 w-8 text-right tabular-nums">
                            {pct}%
                          </span>
                          <span className="text-sm font-bold text-slate-900 tabular-nums w-16 text-right">
                            {row.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${row.bar}`}
                          style={{ width: `${Math.max(pct, row.count > 0 ? 1 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Stacked distribution bar */}
          {!loading && totalAnswered > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Share of all attempts
              </p>
              <div className="flex h-4 rounded-full overflow-hidden gap-[2px]">
                {answeredByFeature
                  .filter(r => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map(row => (
                    <div
                      key={row.key}
                      className={`${row.bar} transition-all duration-700 first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${Math.max((row.count / totalAnswered) * 100, 1)}%` }}
                      title={`${row.label}: ${row.count.toLocaleString()} (${Math.round((row.count / totalAnswered) * 100)}%)`}
                    />
                  ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                {answeredByFeature
                  .filter(r => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map(row => (
                    <div key={row.key} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                      <span className="text-[11px] text-slate-500">{row.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${row.badge}`}>
                        {row.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION — Repeat Feature Usage (Habitual Engagement)
            Which features students return to repeatedly across 2+ distinct days
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} p-6`}>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Repeat size={15} className="text-slate-400" strokeWidth={1.8} />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Repeat Feature Usage
                </h2>
              </div>
              <p className="text-xs text-slate-400 ml-[23px]">
                Students returning to use each feature on 2+ distinct days · {segment === "all" ? "All Users" : segment === "free" ? "Free Users" : "Paid Users"}
              </p>
            </div>
          </div>

          {loading ? (
            <Skeleton rows={4} />
          ) : (data?.repeat_feature_usage ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <Repeat size={28} strokeWidth={1.3} />
              <p className="text-sm font-medium">No repeat feature usage recorded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data?.repeat_feature_usage ?? []).map((rf) => {
                const meta = FEATURES.find((f) => f.key === rf.feature) || {
                  label: rf.feature.replace(/_/g, " "),
                  desc: "Feature surface",
                  bar: "bg-indigo-500",
                  dot: "bg-indigo-500",
                  badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
                };
                return (
                  <div key={rf.feature} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                        <span className="text-sm font-semibold text-slate-800 truncate">{meta.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${meta.badge}`}>
                        {rf.repeatRate}% repeat
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{meta.desc}</p>

                    <div className="space-y-2">
                      <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                          style={{ width: `${Math.max(rf.repeatRate, rf.repeatStudents > 0 ? 3 : 0)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                        <span>
                          <strong className="text-slate-900 font-bold">{rf.repeatStudents}</strong> of {rf.totalStudents} students on 2+ days
                        </span>
                        <span className="text-slate-400">
                          {rf.totalEvents.toLocaleString()} events · avg <strong className="text-slate-700">{rf.avgEventsPerUser}</strong>/user
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 — Custom Test Funnel
            created → started → completed vs abandoned
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} p-6`}>
          <SectionHeader
            title="Custom Test Funnel"
            icon={ClipboardList}
            sub="created → started → completed vs abandoned"
          />

          {loading ? (
            <Skeleton rows={4} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

              {/* Bars */}
              <div className="space-y-4">
                {[
                  { label: "Tests Created",   value: data?.test_funnel.created   ?? 0, color: "bg-violet-400" },
                  { label: "Tests Started",   value: data?.test_funnel.started   ?? 0, color: "bg-indigo-500" },
                  { label: "Tests Completed", value: data?.test_funnel.completed ?? 0, color: "bg-emerald-500" },
                  { label: "Tests Abandoned", value: data?.test_funnel.abandoned ?? 0, color: "bg-rose-400"   },
                ].map(row => (
                  <FunnelBar
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    max={data?.test_funnel.created ?? 1}
                    color={row.color}
                  />
                ))}
              </div>

              {/* Rate summary */}
              <div className="grid grid-cols-3 gap-3 content-start">
                {[
                  { label: "Start rate",    value: data?.test_funnel.start_rate    ?? 0, invert: false, good: 60 },
                  { label: "Complete rate", value: data?.test_funnel.complete_rate ?? 0, invert: false, good: 70 },
                  { label: "Abandon rate",  value: data?.test_funnel.abandon_rate  ?? 0, invert: true,  good: 30 },
                ].map(p => {
                  const ok = p.invert ? p.value <= p.good : p.value >= p.good;
                  return (
                    <div
                      key={p.label}
                      className={`text-center p-3 rounded-xl border ${
                        ok
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-amber-50 border-amber-100"
                      }`}
                    >
                      <p className={`text-2xl font-black tabular-nums leading-none ${
                        ok ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {p.value}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{p.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — Top Chapters
            Which chapters are students actually studying?
        ══════════════════════════════════════════════════════════════════ */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <SectionHeader
              title="Top Chapters by Attempts"
              icon={BookOpen}
              sub="question_answered across all features · last 30 days"
            />
          </div>

          {loading ? (
            <div className="p-6"><Skeleton rows={8} /></div>
          ) : (data?.top_chapters ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Layers size={28} strokeWidth={1.4} />
              <p className="text-sm">No chapter data yet</p>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {(data?.top_chapters ?? []).map((ch, i) => {
                const max = data?.top_chapters?.[0]?.opens ?? 1;
                const pct = Math.round((ch.opens / max) * 100);
                return (
                  <div key={`${ch.subject}::${ch.chapter}`}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium text-slate-800 truncate">{ch.chapter}</span>
                        <span className="text-slate-400 shrink-0 hidden sm:block text-[10px]">
                          {ch.subject}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-600 shrink-0 ml-2 tabular-nums">
                        {ch.opens.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pb-4 pt-2 border-t border-slate-200">
          <span>Last refreshed: {lastRefresh.toLocaleTimeString("en-IN")}</span>
          <a
            href="/api/export?type=summary"
            download="rookie-feature-usage.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download CSV
          </a>
        </footer>

      </main>
    </div>
  );
}

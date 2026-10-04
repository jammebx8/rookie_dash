"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap, BookOpen, FlaskConical, Sparkles, ClipboardList,
  Eye, Clock, Target, TrendingUp, ChevronRight, BarChart2,
  RefreshCw, Users, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import type { FeaturesData } from "@/app/api/features/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const s = ms / 1_000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

// ─── Design-system tokens (mirrors globals.css) ───────────────────────────────

const CARD  = "bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]";
const SHIM  = "shimmer rounded";

// ─── Feature colour map ───────────────────────────────────────────────────────

const FEAT_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  practice:       { label: "Practice",      icon: BookOpen,      color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  question_viewer:{ label: "Q Viewer",      icon: FlaskConical,  color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-100"   },
  custom_test:    { label: "Custom Tests",  icon: ClipboardList, color: "text-violet-600",  bg: "bg-violet-50 border-violet-100"   },
  recommendation: { label: "Recs",          icon: Sparkles,      color: "text-amber-600",   bg: "bg-amber-50 border-amber-100"     },
  similar:        { label: "Similar Qs",    icon: Zap,           color: "text-sky-600",     bg: "bg-sky-50 border-sky-100"         },
  home:           { label: "Home",          icon: TrendingUp,    color: "text-slate-500",   bg: "bg-slate-50 border-slate-100"     },
  unknown:        { label: "Other",         icon: AlertCircle,   color: "text-slate-400",   bg: "bg-slate-50 border-slate-100"     },
};

function featMeta(feat: string) {
  return FEAT_META[feat] ?? { label: feat, icon: Zap, color: "text-slate-500", bg: "bg-slate-50 border-slate-100" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub, icon: Icon }: { title: string; sub?: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} className="text-slate-400" strokeWidth={1.8} />
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">{title}</h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${SHIM} h-10 w-full`} />
      ))}
    </div>
  );
}

/** Mini sparkbar for daily events */
function SparkBar({ data, loading }: { data: { count: number }[]; loading: boolean }) {
  if (loading) return <div className="flex items-end gap-0.5 h-12 animate-pulse">{Array.from({ length: 30 }).map((_, i) => <div key={i} className={`${SHIM} flex-1`} style={{ height: `${20 + (i % 4) * 15}%` }} />)}</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d, i) => {
        const pct = Math.max((d.count / max) * 100, 2);
        const isLast = i === data.length - 1;
        return (
          <div key={i} className="relative flex-1 group">
            <div className={`w-full rounded-sm ${isLast ? "bg-violet-500" : "bg-slate-200 group-hover:bg-slate-300"}`} style={{ height: `${pct}%` }} />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">{d.count}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Single feature usage pill card */
function FeatureCard({
  feature, totalEvents, uniqueStudents, loading,
}: { feature: string; totalEvents: number; uniqueStudents: number; loading: boolean }) {
  const meta = featMeta(feature);
  const Icon = meta.icon;
  if (loading) return <div className={`${CARD} p-4 animate-pulse`}><div className={`${SHIM} h-16 w-full`} /></div>;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${meta.bg}`}>
          <Icon size={16} className={meta.color} strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{totalEvents.toLocaleString()}</p>
      <p className="text-sm font-medium text-slate-500 mt-0.5">{meta.label} events</p>
      <p className="text-xs text-slate-400 mt-1">
        <span className="font-semibold text-slate-600">{uniqueStudents.toLocaleString()}</span> unique students
      </p>
    </div>
  );
}

/** Funnel bar */
function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-800 tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const [data,       setData]       = useState<FeaturesData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/features", { cache: "no-store" });
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived values ────────────────────────────────────────────────────────

  // Aggregate total events per feature
  const featureTotals = (() => {
    const map = new Map<string, { events: number; students: number }>();
    if (!data) return map;
    for (const fc of data.feature_counts) {
      const existing = map.get(fc.feature) ?? { events: 0, students: 0 };
      map.set(fc.feature, {
        events:   existing.events   + fc.event_count,
        students: Math.max(existing.students, fc.unique_students),
      });
    }
    return map;
  })();

  // Events by name for a detail table
  const eventRows = data?.feature_counts
    .filter(fc => ["question_answered", "question_correct", "question_incorrect",
                   "solution_viewed", "solution_read", "similar_shown",
                   "similar_attempted", "recommendation_shown",
                   "test_created", "test_started", "test_completed", "test_abandoned"].includes(fc.event_name))
    .sort((a, b) => b.event_count - a.event_count)
    ?? [];

  const FEATURES_ORDER = ["practice", "question_viewer", "custom_test", "recommendation", "similar"];

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Feature Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Usage, solution engagement, test funnel, and activation signal
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 bg-white px-3 py-1.5 rounded-lg transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Error banner ── */}
        {!loading && data?.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {data.error}
          </div>
        )}

        {/* ── Row 1: Feature cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {FEATURES_ORDER.map(feat => {
            const t = featureTotals.get(feat) ?? { events: 0, students: 0 };
            return (
              <FeatureCard
                key={feat}
                feature={feat}
                totalEvents={t.events}
                uniqueStudents={t.students}
                loading={loading}
              />
            );
          })}
        </div>

        {/* ── Row 2: Daily events sparkline ── */}
        <div className={`${CARD} p-5`}>
          <SectionHeader title="Daily Events — 30 days" icon={BarChart2} sub="All analytics_events combined" />
          <SparkBar data={data?.daily_events ?? []} loading={loading} />
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{data?.daily_events?.[0]?.label ?? ""}</span>
            <span>Today</span>
          </div>
        </div>

        {/* ── Row 3: Event breakdown table + Test funnel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Event breakdown table */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader title="Event Breakdown" icon={Zap} sub="Last 30 days · key events" />
            </div>
            {loading ? (
              <div className="p-5"><Skeleton rows={8} /></div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {eventRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Zap size={28} strokeWidth={1.4} />
                    <p className="mt-2 text-sm">No events yet — run the migration and start using the app</p>
                  </div>
                ) : eventRows.map((row, i) => {
                  const meta = featMeta(row.feature);
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition">
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <Icon size={13} className={meta.color} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{row.event_name}</p>
                        <p className="text-xs text-slate-400">{meta.label}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{row.event_count.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{row.unique_students} students</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test funnel */}
          <div className={`${CARD} p-5`}>
            <SectionHeader title="Custom Test Funnel" icon={ClipboardList} sub="created → started → completed vs abandoned" />
            {loading ? (
              <Skeleton rows={4} />
            ) : (
              <div className="space-y-5">
                <div className="space-y-3.5">
                  {[
                    { label: "Tests Created",   value: data?.test_funnel.created   ?? 0, color: "bg-violet-500" },
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

                {/* Rate pills */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                  {[
                    { label: "Start rate",    value: data?.test_funnel.start_rate    ?? 0, good: 60 },
                    { label: "Complete rate", value: data?.test_funnel.complete_rate ?? 0, good: 70 },
                    { label: "Abandon rate",  value: data?.test_funnel.abandon_rate  ?? 0, good: 30, invert: true },
                  ].map(p => {
                    const ok = p.invert ? p.value <= p.good : p.value >= p.good;
                    return (
                      <div key={p.label} className={`text-center p-2.5 rounded-xl ${ok ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
                        <p className={`text-xl font-bold tabular-nums ${ok ? "text-emerald-700" : "text-amber-700"}`}>{p.value}%</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{p.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Solution read time + Activation ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Solution read time */}
          <div className={`${CARD} p-5`}>
            <SectionHeader
              title="Solution Engagement"
              icon={Eye}
              sub="Time students spend reading solutions — proxy for solution quality"
            />
            {loading ? (
              <Skeleton rows={3} />
            ) : (data?.solution_stats ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Eye size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No solution_read events yet</p>
                <p className="text-xs mt-1 text-center max-w-xs">These fire after a student opens a solution and stays ≥ 1 s</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(data?.solution_stats ?? []).map(s => {
                  const meta = featMeta(s.feature);
                  const Icon = meta.icon;
                  return (
                    <div key={s.feature} className={`rounded-xl border p-4 ${meta.bg}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={14} className={meta.color} strokeWidth={1.8} />
                        <span className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                        <span className="ml-auto text-xs text-slate-400">{s.count.toLocaleString()} reads</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {[
                          { label: "Avg",    value: fmtMs(s.avg_ms) },
                          { label: "Median", value: fmtMs(s.p50_ms) },
                          { label: "P90",    value: fmtMs(s.p90_ms) },
                        ].map(m => (
                          <div key={m.label}>
                            <p className="text-base font-bold text-slate-900 tabular-nums leading-none">{m.value}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{m.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/50 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Read &gt; 10 s</span>
                        <span className={`font-bold ${s.pct_over_10s >= 40 ? "text-emerald-600" : "text-amber-600"}`}>
                          {s.pct_over_10s}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                  High &ldquo;read &gt; 10 s&rdquo; % = students are genuinely engaging with solutions.
                  Low % = solutions may be too long, confusing, or not helpful enough.
                </p>
              </div>
            )}
          </div>

          {/* Activation funnel */}
          <div className={`${CARD} p-5`}>
            <SectionHeader
              title="Activation Signal"
              icon={Target}
              sub="The behaviour that predicts D7 return — students who hit the threshold in their very first session"
            />
            {loading ? (
              <Skeleton rows={4} />
            ) : (
              <div className="space-y-5">
                {/* Big number */}
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-5xl font-black text-slate-900 leading-none tabular-nums">
                      {data?.activation.activation_rate ?? 0}
                      <span className="text-2xl font-bold text-slate-400">%</span>
                    </p>
                    <p className="text-sm text-slate-500 mt-1.5">activation rate</p>
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          (data?.activation.activation_rate ?? 0) >= 40 ? "bg-emerald-500"
                          : (data?.activation.activation_rate ?? 0) >= 20 ? "bg-amber-500"
                          : "bg-rose-400"}`}
                        style={{ width: `${data?.activation.activation_rate ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total students tracked", value: data?.activation.total_students ?? 0, icon: Users },
                    { label: "Activated",              value: data?.activation.activated ?? 0,       icon: CheckCircle2 },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <s.icon size={13} className="text-slate-400" strokeWidth={1.8} />
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{s.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Threshold definition */}
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3.5">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-1.5">Current threshold</p>
                  <p className="text-sm text-indigo-800 font-medium">
                    {data?.activation.threshold ?? "—"}
                  </p>
                  <p className="text-[11px] text-indigo-500 mt-2 leading-relaxed">
                    Tweak this threshold once you have D7 return data. Students who activated
                    should return at a meaningfully higher rate than those who didn&apos;t.
                  </p>
                </div>

                {/* Guidance */}
                <div className="space-y-2">
                  {[
                    { icon: CheckCircle2, color: "text-emerald-600", text: "≥ 40% activation = strong product-market signal" },
                    { icon: XCircle,      color: "text-rose-500",    text: "< 20% = first session isn't working; investigate drop-offs" },
                    { icon: ChevronRight, color: "text-slate-400",   text: "Compare D7 return rates: activated vs non-activated students" },
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                      <tip.icon size={12} className={`${tip.color} mt-0.5 shrink-0`} strokeWidth={2} />
                      {tip.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 5: Top chapters ── */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <SectionHeader title="Top Chapters by Question Activity" icon={BookOpen} sub="question_answered events last 30 days" />
          </div>
          {loading ? (
            <div className="p-5"><Skeleton rows={8} /></div>
          ) : (data?.top_chapters ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <BookOpen size={28} strokeWidth={1.4} />
              <p className="mt-2 text-sm">No chapter data yet</p>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(data?.top_chapters ?? []).map((ch, i) => {
                const max = data?.top_chapters?.[0]?.opens ?? 1;
                const pct = Math.round((ch.opens / max) * 100);
                return (
                  <div key={`${ch.subject}::${ch.chapter}`}>
                    <div className="flex items-center justify-between mb-0.5 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="font-medium text-slate-800 truncate">{ch.chapter}</span>
                        <span className="text-slate-400 shrink-0 hidden sm:block">{ch.subject}</span>
                      </div>
                      <span className="font-semibold text-slate-600 shrink-0 ml-2">{ch.opens}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
          <div className="flex items-center gap-3">
            <a href="/api/export" download="rookie-features.csv"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download CSV
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
}

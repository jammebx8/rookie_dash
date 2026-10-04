"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BookOpen, ClipboardList, Layers, RefreshCw, Target,
} from "lucide-react";
import type { FeaturesData } from "@/app/api/features/route";

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD = "bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]";
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
    key:   "question_viewer",
    label: "Question Viewer",
    desc:  "Chapter-mode questions (Practice → subject → chapter page)",
    bar:   "bg-indigo-500",
    dot:   "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    key:   "similar",
    label: "Similar Questions",
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [data,        setData]        = useState<FeaturesData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Feature Usage</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Which feature students are using most
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

        {/* ── Error ── */}
        {!loading && data?.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {data.error}
          </div>
        )}

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

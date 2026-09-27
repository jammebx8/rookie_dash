"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  Flame,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  Activity,
  Award,
  BarChart2,
  Calendar,
  UserCheck,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekDay {
  date: string;
  label: string;
  users: number;
}

interface TopChapter {
  title: string;
  count: number;
  subject: string;
}

interface RecentUser {
  userId: string;
  shortId: string;
  chapter: string;
  subject: string;
  lastSeen: string;
}

interface FirebaseUser {
  userId: string;
  displayName: string;
  email: string;
  durationSec: number;
  startedAt: string;
}

interface MetricsData {
  activeStudentsToday: number;
  totalQuestionsToday: number;
  avgTimeSec: number;
  accuracyRate: number;
  retention: number;
  avgStreak: number;
  maxStreak: number;
  topChapters: TopChapter[];
  weeklyActivity: WeekDay[];
  recentUsers: RecentUser[];
}

interface VisitorData {
  totalVisitors: number;
  avgDurationSec: number;
  usersToday: FirebaseUser[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  trend,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "indigo" | "amber" | "red" | "default";
  trend?: "up" | "down" | "flat";
  loading?: boolean;
}) {
  const accentMap = {
    green:  { bg: "bg-emerald-50",  icon: "text-emerald-600", ring: "border-emerald-100" },
    indigo: { bg: "bg-indigo-50",   icon: "text-indigo-600",  ring: "border-indigo-100"  },
    amber:  { bg: "bg-amber-50",    icon: "text-amber-600",   ring: "border-amber-100"   },
    red:    { bg: "bg-red-50",      icon: "text-red-600",     ring: "border-red-100"     },
    default:{ bg: "bg-slate-50",    icon: "text-slate-500",   ring: "border-slate-100"   },
  };
  const c = accentMap[accent ?? "default"];
  const TrendIcon = trend === "up" ? ChevronUp : trend === "down" ? ChevronDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";

  if (loading) {
    return (
      <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="shimmer h-4 w-24 rounded mb-3" />
        <div className="shimmer h-8 w-16 rounded mb-2" />
        <div className="shimmer h-3 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.ring} border flex items-center justify-center shrink-0`}>
          <Icon size={18} className={c.icon} strokeWidth={1.8} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon size={13} />
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900 leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-slate-400" strokeWidth={1.8} />
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function MiniBarChart({ data, loading }: { data: WeekDay[]; loading: boolean }) {
  const max = Math.max(...data.map((d) => d.users), 1);
  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-end gap-1.5 h-16">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 shimmer rounded-sm" style={{ height: `${30 + i * 5}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d) => {
        const pct = Math.max((d.users / max) * 100, 4);
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className={`w-full rounded-sm transition-all bar-fill ${
                isToday ? "bg-emerald-500" : "bg-slate-200 group-hover:bg-slate-300"
              }`}
              style={{ height: `${pct}%` }}
            />
            {/* tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
              {d.users} users
            </div>
            <span className="text-[9px] text-slate-400 leading-none">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RetentionRing({ pct, loading }: { pct: number; loading: boolean }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  if (loading) {
    return <div className="w-24 h-24 rounded-full shimmer" />;
  }

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <text
        x="48"
        y="48"
        dominantBaseline="middle"
        textAnchor="middle"
        className="rotate-90"
        style={{ transform: "rotate(90deg)", transformOrigin: "48px 48px" }}
        fill="#0f172a"
        fontSize="15"
        fontWeight="700"
        fontFamily="system-ui"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [visitors, setVisitors] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [mRes, vRes] = await Promise.all([
        fetch("/api/metrics", { cache: "no-store" }),
        fetch("/api/users-today", { cache: "no-store" }),
      ]);
      const [m, v] = await Promise.all([mRes.json(), vRes.json()]);
      setMetrics(m);
      setVisitors(v);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 2 minutes
    const id = setInterval(() => fetchAll(true), 120_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#10b981" />
              <path
                d="M8 20V10l6-3 6 3v10"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 20v-5h6v5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-bold text-slate-900 text-base tracking-tight">Rookie</span>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-400">{today}</span>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">

        {/* ── Hero banner ── */}
        <section className="relative overflow-hidden rounded-2xl mb-7 bg-gradient-to-br from-slate-950 via-[#001428] to-emerald-950 text-white shadow-[0_4px_32px_rgba(0,0,0,0.18)]">
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.25] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* glow blobs */}
          <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          {/* top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500" />

          <div className="relative px-6 sm:px-8 py-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-xs font-medium text-white/60 uppercase tracking-wider">
                    <Calendar size={10} />
                    {today}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-xs font-semibold text-emerald-300">
                    <Activity size={10} />
                    Live
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                  Platform Overview
                </h1>
                <p className="text-white/50 text-sm mt-1.5">
                  Real-time metrics for the Rookie learning platform
                </p>
              </div>

              {/* summary pills */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12]">
                  <span className="text-3xl font-bold text-white leading-none">
                    {loading ? "—" : metrics?.activeStudentsToday ?? 0}
                  </span>
                  <span className="text-[11px] text-white/50 mt-1 uppercase tracking-wide">
                    active today
                  </span>
                </div>
                <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12]">
                  <span className="text-3xl font-bold text-emerald-300 leading-none">
                    {loading ? "—" : `${metrics?.retention ?? 0}%`}
                  </span>
                  <span className="text-[11px] text-white/50 mt-1 uppercase tracking-wide">
                    retention
                  </span>
                </div>
              </div>
            </div>

            {/* 7-day sparkline inside hero */}
            {!loading && metrics?.weeklyActivity && (
              <div className="mt-5 pt-5 border-t border-white/[0.08]">
                <p className="text-xs text-white/40 mb-3 uppercase tracking-wide font-medium">
                  7-day active users
                </p>
                <div className="flex items-end gap-1.5 h-10">
                  {metrics.weeklyActivity.map((d) => {
                    const max = Math.max(...metrics.weeklyActivity.map((x) => x.users), 1);
                    const pct = Math.max((d.users / max) * 100, 6);
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-sm ${
                            isToday ? "bg-emerald-400" : "bg-white/20"
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                        <span className="text-[9px] text-white/30 leading-none">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">
          <StatCard
            icon={Users}
            label="Students today"
            value={loading ? "—" : metrics?.activeStudentsToday ?? 0}
            sub="solved at least 1 question"
            accent="green"
            trend="up"
            loading={loading}
          />
          <StatCard
            icon={BookOpen}
            label="Questions solved"
            value={loading ? "—" : metrics?.totalQuestionsToday ?? 0}
            sub="today"
            accent="indigo"
            loading={loading}
          />
          <StatCard
            icon={Clock}
            label="Avg time / question"
            value={loading ? "—" : fmtSeconds(metrics?.avgTimeSec ?? 0)}
            sub="today"
            accent="amber"
            loading={loading}
          />
          <StatCard
            icon={Target}
            label="Accuracy"
            value={loading ? "—" : `${metrics?.accuracyRate ?? 0}%`}
            sub="correct answers today"
            accent="green"
            trend={
              (metrics?.accuracyRate ?? 0) >= 70
                ? "up"
                : (metrics?.accuracyRate ?? 0) >= 40
                ? "flat"
                : "down"
            }
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Retention"
            value={loading ? "—" : `${metrics?.retention ?? 0}%`}
            sub="returned from yesterday"
            accent={
              (metrics?.retention ?? 0) >= 50
                ? "green"
                : (metrics?.retention ?? 0) >= 25
                ? "amber"
                : "red"
            }
            loading={loading}
          />
          <StatCard
            icon={UserCheck}
            label="Visitors today"
            value={loading ? "—" : visitors?.totalVisitors ?? 0}
            sub={
              visitors?.avgDurationSec
                ? `avg ${fmtSeconds(visitors.avgDurationSec)} on site`
                : "from Firebase"
            }
            accent="indigo"
            loading={loading}
          />
        </div>

        {/* ── Row 2: bar chart + retention ring + streaks ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">

          {/* Weekly bar chart */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="7-Day Active Users" icon={BarChart2} />
            <MiniBarChart data={metrics?.weeklyActivity ?? []} loading={loading} />
            <p className="text-xs text-slate-400 mt-3">
              Unique students who answered at least one question per day
            </p>
          </div>

          {/* Retention ring */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col">
            <SectionHeader title="Day-1 Retention" icon={TrendingUp} />
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <RetentionRing pct={metrics?.retention ?? 0} loading={loading} />
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                % of yesterday&apos;s active users who returned today
              </p>
            </div>
          </div>
        </div>

        {/* ── Row 3: top chapters + streak stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">

          {/* Top chapters */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="Top Chapters Today" icon={BookOpen} />
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="shimmer h-9 rounded-lg" />
                ))}
              </div>
            ) : (metrics?.topChapters ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <BookOpen size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No activity yet today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(metrics?.topChapters ?? []).map((ch, i) => {
                  const max = metrics!.topChapters[0].count;
                  const pct = Math.round((ch.count / max) * 100);
                  return (
                    <div key={ch.title} className="group">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">{ch.title}</span>
                          <span className="text-xs text-slate-400 shrink-0">{ch.subject}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 shrink-0 ml-2">
                          {ch.count}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Streak stats */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="Streak Stats" icon={Flame} />
            {loading ? (
              <div className="space-y-4">
                <div className="shimmer h-16 rounded-xl" />
                <div className="shimmer h-16 rounded-xl" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                      Avg current streak
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 leading-none">
                    {metrics?.avgStreak ?? 0}
                    <span className="text-base font-medium ml-1">days</span>
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                      All-time record
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-indigo-600 leading-none">
                    {metrics?.maxStreak ?? 0}
                    <span className="text-base font-medium ml-1">days</span>
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Avg session time
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-700 leading-none">
                    {fmtSeconds(visitors?.avgDurationSec ?? 0)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">on-site (Firebase)</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Recent active users (Supabase) + Today's visitors (Firebase) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7">

          {/* Recent active users from Supabase */}
          <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader title="Recently Active Students" icon={Activity} />
            </div>
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="shimmer w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="shimmer h-3 w-28 rounded" />
                      <div className="shimmer h-2.5 w-40 rounded" />
                    </div>
                    <div className="shimmer h-2.5 w-12 rounded" />
                  </div>
                ))}
              </div>
            ) : (metrics?.recentUsers ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Users size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(metrics?.recentUsers ?? []).map((u) => (
                  <div key={u.userId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                    {/* avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[11px] font-bold">
                        {u.shortId.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate font-mono">
                        {u.shortId}…
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {u.subject} — {u.chapter}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{timeAgo(u.lastSeen)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's visitors from Firebase */}
          <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <SectionHeader title="Website Visitors Today" icon={UserCheck} />
                {visitors?.error && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                    Firebase fallback
                  </span>
                )}
              </div>
            </div>
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="shimmer w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="shimmer h-3 w-32 rounded" />
                      <div className="shimmer h-2.5 w-24 rounded" />
                    </div>
                    <div className="shimmer h-2.5 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : (visitors?.usersToday ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <UserCheck size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No visitor data yet today</p>
                <p className="text-xs mt-1 text-slate-300">Check your Firebase sessions collection</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                {(visitors?.usersToday ?? []).map((u) => (
                  <div key={u.userId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[11px] font-bold">
                        {(u.displayName?.[0] ?? "U").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {u.displayName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {fmtTime(u.startedAt)} &middot; {fmtSeconds(u.durationSec)} on site
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{timeAgo(u.startedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between text-xs text-slate-400 pb-4">
          <span>
            Last refreshed: {lastRefresh.toLocaleTimeString("en-IN")}
          </span>
          <span>Auto-refreshes every 2 minutes</span>
        </footer>
      </main>
    </div>
  );
}

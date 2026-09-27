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
  UserPlus,
  Repeat2,
  ArrowUpRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekDay {
  date: string;
  label: string;
  users: number;
}

interface Chapter {
  title: string;
  count: number;
  subject: string;
}

interface RecentUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  chapter: string;
  subject: string;
  lastSeen: string;
}

interface MetricsData {
  activeStudentsToday: number;
  totalQuestionsToday: number;
  avgTimeSec: number;
  accuracyRate: number;
  retention: number;
  avgStreak: number;
  maxStreak: number;
  topChapters: Chapter[];
  weeklyActivity: WeekDay[];
  recentUsers: RecentUser[];
  queryErrors?: Record<string, string>;
  error?: string;
}

interface SignupData {
  totalUsers: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  signupTimeseries: { date: string; label: string; count: number }[];
  error?: string;
}

interface EngagementData {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  dauTimeseries: { date: string; label: string; dau: number }[];
  error?: string;
}

interface CohortRow {
  cohortDate: string;
  cohortLabel: string;
  cohortSize: number;
  dn: (number | null)[];
}

interface RetainedUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  activeDaysLast7: number;
}

interface RetentionData {
  cohortTable: CohortRow[];
  rollingDn: (number | null)[];
  monthlyRetention: number;
  lastMonthActiveUsers: number;
  thisMonthActiveUsers: number;
  monthlyRetained: number;
  topRetainedUsers: RetainedUser[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-slate-300";
  if (pct >= 40) return "text-emerald-600";
  if (pct >= 20) return "text-amber-600";
  return "text-red-500";
}

function pctBg(pct: number | null): string {
  if (pct === null) return "bg-slate-50";
  if (pct >= 40) return "bg-emerald-50";
  if (pct >= 20) return "bg-amber-50";
  return "bg-red-50";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "default",
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
    green:   { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "border-emerald-100" },
    indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  ring: "border-indigo-100"  },
    amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   ring: "border-amber-100"   },
    red:     { bg: "bg-red-50",     icon: "text-red-600",     ring: "border-red-100"     },
    default: { bg: "bg-slate-50",   icon: "text-slate-500",   ring: "border-slate-100"   },
  };
  const c = accentMap[accent];
  const TrendIcon = trend === "up" ? ChevronUp : trend === "down" ? ChevronDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";

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
      <p className="mt-4 text-2xl font-bold text-slate-900 leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  sub,
}: {
  title: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-slate-400" strokeWidth={1.8} />
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide leading-none">
          {title}
        </h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function UserAvatar({
  name,
  avatarUrl,
  gradient,
}: {
  name: string;
  avatarUrl: string;
  gradient: "emerald" | "indigo" | "violet";
}) {
  const initials =
    name
      .split(" ")
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const gMap = {
    emerald: "from-emerald-400 to-emerald-600",
    indigo:  "from-indigo-400 to-indigo-600",
    violet:  "from-violet-400 to-violet-600",
  };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`w-9 h-9 rounded-full bg-gradient-to-br ${gMap[gradient]} flex items-center justify-center shrink-0`}
    >
      <span className="text-white text-[11px] font-bold">{initials}</span>
    </div>
  );
}

/** Inline bar chart used for DAU sparkline / signup sparkline */
function SparkBar({
  data,
  valueKey,
  loading,
  highlightLast = true,
  color = "emerald",
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  loading: boolean;
  highlightLast?: boolean;
  color?: "emerald" | "indigo" | "violet";
}) {
  const colorMap = {
    emerald: { active: "bg-emerald-500", inactive: "bg-slate-200 group-hover:bg-slate-300" },
    indigo:  { active: "bg-indigo-500",  inactive: "bg-slate-200 group-hover:bg-slate-300" },
    violet:  { active: "bg-violet-500",  inactive: "bg-slate-200 group-hover:bg-slate-300" },
  };
  const cols = colorMap[color];

  if (loading) {
    return (
      <div className="flex items-end gap-0.5 h-14">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="flex-1 shimmer rounded-sm" style={{ height: `${20 + (i % 5) * 15}%` }} />
        ))}
      </div>
    );
  }

  const values = data.map((d) => (d[valueKey] as number) ?? 0);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-0.5 h-14">
      {data.map((d, i) => {
        const val = (d[valueKey] as number) ?? 0;
        const pct = Math.max((val / max) * 100, 2);
        const isLast = highlightLast && i === data.length - 1;
        return (
          <div key={i} className="flex-1 relative group">
            <div
              className={`w-full rounded-sm transition-all ${isLast ? cols.active : cols.inactive}`}
              style={{ height: `${pct}%` }}
            />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
              {val}
            </div>
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

  if (loading) return <div className="w-24 h-24 rounded-full shimmer" />;

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

// ─── Cohort Heatmap ───────────────────────────────────────────────────────────

function CohortHeatmap({
  rows,
  loading,
}: {
  rows: CohortRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer h-8 rounded" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <Repeat2 size={28} strokeWidth={1.4} />
        <p className="mt-2 text-sm">Not enough data yet</p>
      </div>
    );
  }

  const days = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium pb-2 pr-3 whitespace-nowrap w-20">
              Cohort
            </th>
            <th className="text-slate-400 font-medium pb-2 px-1 w-12">Size</th>
            {days.map((d) => (
              <th key={d} className="text-slate-400 font-medium pb-2 px-1 w-12">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohortDate}>
              <td className="text-slate-600 font-medium pr-3 py-0.5 whitespace-nowrap">
                {row.cohortLabel}
              </td>
              <td className="text-center text-slate-500 py-0.5 px-1">{row.cohortSize}</td>
              {row.dn.map((pct, i) => (
                <td key={i} className="py-0.5 px-0.5">
                  {pct === null ? (
                    <div className="h-7 rounded flex items-center justify-center bg-slate-50 text-slate-300">
                      —
                    </div>
                  ) : (
                    <div
                      className={`h-7 rounded flex items-center justify-center font-semibold ${pctBg(pct)} ${pctColor(pct)}`}
                    >
                      {pct}%
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {/* Rolling average row */}
      </table>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [metrics,    setMetrics]    = useState<MetricsData    | null>(null);
  const [signups,    setSignups]    = useState<SignupData      | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [retention,  setRetention]  = useState<RetentionData  | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [mRes, sRes, eRes, rRes] = await Promise.all([
        fetch("/api/metrics",    { cache: "no-store" }),
        fetch("/api/signups",    { cache: "no-store" }),
        fetch("/api/engagement", { cache: "no-store" }),
        fetch("/api/retention",  { cache: "no-store" }),
      ]);
      const [m, s, e, r] = await Promise.all([
        mRes.json(), sRes.json(), eRes.json(), rRes.json(),
      ]);
      setMetrics(m);
      setSignups(s);
      setEngagement(e);
      setRetention(r);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 120_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">

      {/* ── Navbar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#10b981" />
              <path d="M8 20V10l6-3 6 3v10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 20v-5h6v5"        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* ── Hero banner ── */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#001428] to-emerald-950 text-white shadow-[0_4px_32px_rgba(0,0,0,0.18)]">
          <div className="absolute inset-0 opacity-[0.25] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
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
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Platform Overview</h1>
                <p className="text-white/50 text-sm mt-1.5">Real-time metrics for the Rookie learning platform</p>
              </div>

              {/* hero summary pills */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {[
                  { label: "total users",   value: loading ? "—" : (signups?.totalUsers    ?? 0).toLocaleString() },
                  { label: "active today",  value: loading ? "—" : (metrics?.activeStudentsToday ?? 0).toString(), green: true },
                  { label: "D1 retention",  value: loading ? "—" : `${retention?.rollingDn?.[0] ?? metrics?.retention ?? 0}%` },
                  { label: "DAU/MAU",       value: loading ? "—" : `${engagement?.stickiness ?? 0}%` },
                ].map(({ label, value, green }) => (
                  <div key={label} className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12]">
                    <span className={`text-2xl font-bold leading-none ${green ? "text-emerald-300" : "text-white"}`}>{value}</span>
                    <span className="text-[11px] text-white/50 mt-1 uppercase tracking-wide whitespace-nowrap">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-day sparkline */}
            {!loading && metrics?.weeklyActivity && (
              <div className="mt-5 pt-5 border-t border-white/[0.08]">
                <p className="text-xs text-white/40 mb-3 uppercase tracking-wide font-medium">7-day active users</p>
                <div className="flex items-end gap-1.5 h-10">
                  {metrics.weeklyActivity.map((d) => {
                    const max = Math.max(...metrics.weeklyActivity.map((x) => x.users), 1);
                    const pct = Math.max((d.users / max) * 100, 6);
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full rounded-sm ${isToday ? "bg-emerald-400" : "bg-white/20"}`} style={{ height: `${pct}%` }} />
                        <span className="text-[9px] text-white/30 leading-none">{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Error banner ── */}
        {!loading && metrics?.queryErrors && Object.keys(metrics.queryErrors).length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-semibold text-red-700 mb-1">
              Supabase errors — check credentials in <code className="font-mono bg-red-100 px-1 rounded">.env</code>
            </p>
            <ul className="space-y-0.5">
              {Object.entries(metrics.queryErrors).map(([k, v]) => (
                <li key={k} className="text-xs text-red-600 font-mono"><span className="font-semibold">{k}:</span> {v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Row 1: Core KPI tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users}     label="Students today"      value={loading ? "—" : metrics?.activeStudentsToday ?? 0}   sub="solved 1+ question"            accent="green"   trend="up" loading={loading} />
          <StatCard icon={BookOpen}  label="Questions solved"    value={loading ? "—" : metrics?.totalQuestionsToday ?? 0}   sub="today"                         accent="indigo"            loading={loading} />
          <StatCard icon={Clock}     label="Avg time / question" value={loading ? "—" : fmtSeconds(metrics?.avgTimeSec ?? 0)} sub="today"                         accent="amber"             loading={loading} />
          <StatCard icon={Target}    label="Accuracy"            value={loading ? "—" : `${metrics?.accuracyRate ?? 0}%`}    sub="correct answers today"         accent="green"   trend={(metrics?.accuracyRate ?? 0) >= 70 ? "up" : (metrics?.accuracyRate ?? 0) >= 40 ? "flat" : "down"} loading={loading} />
          <StatCard icon={UserPlus}  label="Total users"         value={loading ? "—" : (signups?.totalUsers ?? 0).toLocaleString()} sub={`+${signups?.newSignupsToday ?? 0} today`} accent="indigo" loading={loading} />
          <StatCard icon={Flame}     label="Avg streak"          value={loading ? "—" : `${metrics?.avgStreak ?? 0}d`}       sub={`max ${metrics?.maxStreak ?? 0}d ever`} accent="amber" loading={loading} />
        </div>

        {/* ── Row 2: DAU / WAU / MAU + stickiness ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Activity}   label="DAU"        value={loading ? "—" : (engagement?.dau ?? 0)} sub="today"           accent="green"   loading={loading} />
          <StatCard icon={BarChart2}  label="WAU"        value={loading ? "—" : (engagement?.wau ?? 0)} sub="last 7 days"     accent="indigo"  loading={loading} />
          <StatCard icon={TrendingUp} label="MAU"        value={loading ? "—" : (engagement?.mau ?? 0)} sub="last 30 days"    accent="default" loading={loading} />
          <StatCard icon={Zap}        label="Stickiness" value={loading ? "—" : `${engagement?.stickiness ?? 0}%`} sub="DAU / MAU ratio" accent={(engagement?.stickiness ?? 0) >= 20 ? "green" : "amber"} loading={loading} />
        </div>

        {/* ── Row 3: DAU chart + signup chart ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="Daily Active Users — 30 days" icon={Activity} sub="Unique students who answered at least 1 question" />
            <SparkBar data={engagement?.dauTimeseries ?? []} valueKey="dau" loading={loading} color="emerald" />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400">{engagement?.dauTimeseries?.[0]?.label ?? ""}</span>
              <span className="text-[10px] text-slate-400">Today</span>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="New Signups — 30 days" icon={UserPlus} sub={`${signups?.newSignupsThisWeek ?? 0} new this week · ${signups?.newSignupsToday ?? 0} today`} />
            <SparkBar data={signups?.signupTimeseries ?? []} valueKey="count" loading={loading} color="indigo" />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400">{signups?.signupTimeseries?.[0]?.label ?? ""}</span>
              <span className="text-[10px] text-slate-400">Today</span>
            </div>
          </div>
        </div>

        {/* ── Row 4: Retention — the main section ── */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <SectionHeader
              title="Cohort Retention — D1 to D7"
              icon={Repeat2}
              sub="% of each day's new users who returned on each subsequent day"
            />
            {/* Rolling averages pill row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(retention?.rollingDn ?? []).map((pct, i) => (
                <span
                  key={i}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${pctBg(pct)} ${pctColor(pct)} border-current/20`}
                >
                  D{i + 1}: {pct !== null ? `${pct}%` : "—"}
                </span>
              ))}
            </div>
          </div>
          <div className="p-5">
            <CohortHeatmap rows={retention?.cohortTable ?? []} loading={loading} />
          </div>
        </div>

        {/* ── Row 5: Monthly retention + top retained users ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Monthly retention card */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col">
            <SectionHeader title="Monthly Retention" icon={TrendingUp} />
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <RetentionRing pct={retention?.monthlyRetention ?? 0} loading={loading} />
              <div className="text-center space-y-1">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Last month&apos;s users who returned this month
                </p>
                {!loading && (
                  <p className="text-xs text-slate-400">
                    {retention?.monthlyRetained ?? 0} of {retention?.lastMonthActiveUsers ?? 0} users
                  </p>
                )}
              </div>
            </div>
            {!loading && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-slate-800">{retention?.lastMonthActiveUsers ?? 0}</p>
                  <p className="text-xs text-slate-400">Last month</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600">{retention?.thisMonthActiveUsers ?? 0}</p>
                  <p className="text-xs text-slate-400">This month</p>
                </div>
              </div>
            )}
          </div>

          {/* Top retained users — active 5+ of last 7 days */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader
                title="Power Users — last 7 days"
                icon={Award}
                sub="Active on 5 or more of the last 7 days"
              />
            </div>
            {loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="shimmer w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="shimmer h-3 w-28 rounded" />
                      <div className="shimmer h-2.5 w-40 rounded" />
                    </div>
                    <div className="shimmer h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (retention?.topRetainedUsers ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Award size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No power users yet this week</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {(retention?.topRetainedUsers ?? []).map((u, i) => (
                  <div key={u.userId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                    <span className="w-5 text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="violet" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {Array.from({ length: 7 }).map((_, d) => (
                        <div
                          key={d}
                          className={`w-2.5 h-2.5 rounded-sm ${d < u.activeDaysLast7 ? "bg-emerald-500" : "bg-slate-200"}`}
                        />
                      ))}
                      <span className="ml-1.5 text-xs font-semibold text-slate-500">{u.activeDaysLast7}/7</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 6: All chapters today + streak stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* All chapters today — scrollable */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader
                title="All Chapters Solved Today"
                icon={BookOpen}
                sub={`${metrics?.topChapters?.length ?? 0} chapters active`}
              />
            </div>
            {loading ? (
              <div className="p-5 space-y-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shimmer h-8 rounded-lg" />
                ))}
              </div>
            ) : (metrics?.topChapters ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <BookOpen size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No activity yet today</p>
              </div>
            ) : (
              <div className="p-5 space-y-2 max-h-[420px] overflow-y-auto">
                {(metrics?.topChapters ?? []).map((ch, i) => {
                  const max = metrics!.topChapters[0].count;
                  const pct = Math.round((ch.count / max) * 100);
                  return (
                    <div key={ch.title}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">{ch.title}</span>
                          <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{ch.subject}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 shrink-0 ml-2">{ch.count}</span>
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
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Flame size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Avg current streak</span>
                  </div>
                  <p className="text-3xl font-bold text-amber-600 leading-none">
                    {metrics?.avgStreak ?? 0}<span className="text-base font-medium ml-1">days</span>
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Award size={13} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">All-time record</span>
                  </div>
                  <p className="text-3xl font-bold text-indigo-600 leading-none">
                    {metrics?.maxStreak ?? 0}<span className="text-base font-medium ml-1">days</span>
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpRight size={13} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">New signups this week</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 leading-none">
                    {signups?.newSignupsThisWeek ?? 0}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 7: Recently active students ── */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <SectionHeader title="Recently Active Students" icon={Activity} sub="Last updated session from user_recent_session" />
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 border-b border-slate-100">
                  <div className="shimmer w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="shimmer h-3 w-28 rounded" />
                    <div className="shimmer h-2.5 w-44 rounded" />
                  </div>
                  <div className="shimmer h-2.5 w-10 rounded" />
                </div>
              ))}
            </div>
          ) : (metrics?.recentUsers ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users size={28} strokeWidth={1.4} />
              <p className="mt-2 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {(metrics?.recentUsers ?? []).map((u) => (
                <div key={u.userId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition border-b border-slate-100">
                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="emerald" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{u.subject} — {u.chapter}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{timeAgo(u.lastSeen)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="flex items-center justify-between text-xs text-slate-400 pb-2">
          <span>Last refreshed: {lastRefresh.toLocaleTimeString("en-IN")}</span>
          <span>Auto-refreshes every 2 min</span>
        </footer>

      </main>
    </div>
  );
}

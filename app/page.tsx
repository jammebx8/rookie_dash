"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  BookOpen,
  Clock,
  Target,
  TrendingUp,
  Flame,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  UserCheck,
  UserX,
  UserMinus,
  Zap,
  UserPlus,
  Repeat2,
  ArrowUpRight,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Filter,
  BarChart2,
  Activity,
  Search,
  Crown,
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

interface DirectoryUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  class: string;
  exam: string;
  rookieCoins: number;
  createdAt: string;
  totalAttempts: number;
  lastSeen: string;
  isPaid: boolean;
  planId: string;
  isNew: boolean;
}

interface MultiCheckoutUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  checkoutCount: number;
  isPaid: boolean;
  status: "paid" | "abandoned";
  planId: string;
  lastCheckoutAt: string;
  firstCheckoutAt?: string;
}

interface LimitExceededUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  maxInSingleDay: number;
  totalAnswered: number;
  daysExceededCount: number;
  lastExceededDate: string;
  isPaid: boolean;
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
  multipleCheckoutUsers?: {
    totalOpeners: number;
    multiOpenersCount: number;
    multiOpenersRate: number;
    convertedCount: number;
    abandonedCount: number;
    users: MultiCheckoutUser[];
  };
  limitExceededUsers?: {
    totalSolvers: number;
    exceededCount: number;
    exceededRate: number;
    keptSolvingBuckets: {
      q4to5: number;
      q6to10: number;
      q11to20: number;
      q21plus: number;
    };
    users: LimitExceededUser[];
  };
  queryErrors?: Record<string, string>;
  error?: string;
}

interface SignupData {
  totalAccounts: number;
  totalStudents: number;
  conversionRate: number;
  newSignupsToday: number;
  newSignupsThisWeek: number;
  signupTimeseries: { date: string; label: string; count: number }[];
  studentError?: string;
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
  isPaid?: boolean;
}

interface DropoffProductUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  onlyActiveDate: string;
  questionsCount: number;
  firstChapter: string;
  isPaid: boolean;
}

interface DropoffSignupUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string;
  signupAt: string;
  activityType: "zero_activity" | "day1_only";
  questionsCount: number;
  isPaid: boolean;
}

interface RetentionData {
  interval: "daily" | "weekly" | "monthly";
  segment: "all" | "free" | "paid";
  headers: string[];
  cohortTable: CohortRow[];
  rollingDn: (number | null)[];
  monthlyRetention: number;
  lastMonthActiveUsers: number;
  thisMonthActiveUsers: number;
  monthlyRetained: number;
  topRetainedUsers: RetainedUser[];
  neverReturnedAfterUsing?: {
    total: number;
    neverReturnedCount: number;
    neverReturnedPct: number;
    returnedCount: number;
    returnedPct: number;
    sampleUsers: DropoffProductUser[];
  };
  neverReturnedAfterSignup?: {
    totalSignups: number;
    neverReturnedCount: number;
    neverReturnedPct: number;
    zeroActivityCount: number;
    zeroActivityPct: number;
    day1OnlyCount: number;
    day1OnlyPct: number;
    returnedCount: number;
    returnedPct: number;
    sampleUsers: DropoffSignupUser[];
  };
  repeatPlatformUsage?: {
    totalUsers: number;
    repeatUsersCount: number;
    repeatRate: number;
    distribution: { label: string; days: string | number; count: number; pct: number }[];
  };
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
  if (!iso) return "—";
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
  loading = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "green" | "indigo" | "amber" | "rose";
  trend?: "up" | "down" | "flat";
  loading?: boolean;
}) {
  const accentClasses = {
    default: "bg-slate-50 text-slate-600 border-slate-100",
    green:   "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo:  "bg-indigo-50 text-indigo-600 border-indigo-100",
    amber:   "bg-amber-50 text-amber-600 border-amber-100",
    rose:    "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="bg-white rounded-[14px] border border-slate-200 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate pr-1">
          {label}
        </span>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${accentClasses[accent]}`}>
          <Icon size={14} strokeWidth={2} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          {loading ? (
            <div className="shimmer h-7 w-16 rounded" />
          ) : (
            <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none">
              {value}
            </span>
          )}
          {trend === "up" && <span className="text-emerald-600 text-xs font-semibold">▲</span>}
          {trend === "down" && <span className="text-rose-500 text-xs font-semibold">▼</span>}
        </div>
        {sub && <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  sub,
  icon: Icon,
}: {
  title: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight leading-none">
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
  gradient = "emerald",
}: {
  name: string;
  avatarUrl: string;
  gradient?: "emerald" | "indigo" | "violet" | "amber";
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
    amber:   "from-amber-400 to-amber-600",
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
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gMap[gradient]} flex items-center justify-center shrink-0`}>
      <span className="text-white text-[11px] font-bold">{initials}</span>
    </div>
  );
}

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

// ─── Dynamic Cohort Heatmap ───────────────────────────────────────────────────

function CohortHeatmap({
  rows,
  headers = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
  loading,
}: {
  rows: CohortRow[];
  headers?: string[];
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
        <p className="mt-2 text-sm">Not enough cohort data in this segment</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium pb-2 pr-3 whitespace-nowrap w-24">
              Cohort
            </th>
            <th className="text-slate-400 font-medium pb-2 px-1 w-12 text-center">Size</th>
            {headers.map((h) => (
              <th key={h} className="text-slate-400 font-medium pb-2 px-1 w-12 text-center">
                {h}
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
      </table>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [metrics,    setMetrics]    = useState<MetricsData    | null>(null);
  const [signups,    setSignups]    = useState<SignupData      | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [retention,  setRetention]  = useState<RetentionData  | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Interactive controls for Cohort Retention
  const [retentionInterval, setRetentionInterval] = useState<"daily" | "weekly" | "monthly">("daily");
  const [retentionSegment,  setRetentionSegment]  = useState<"all" | "free" | "paid">("all");

  // Toggleable lists for drop-off users
  const [showProductDropoff, setShowProductDropoff] = useState(false);
  const [showSignupDropoff,  setShowSignupDropoff]  = useState(false);

  // All registered users directory state
  const [allUsers,   setAllUsers]   = useState<DirectoryUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "paid" | "free" | "new">("all");

  const fetchRetention = useCallback(async (intv = retentionInterval, seg = retentionSegment) => {
    setRetentionLoading(true);
    try {
      const res = await fetch(`/api/retention?interval=${intv}&segment=${seg}`, { cache: "no-store" });
      const r = await res.json();
      setRetention(r);
    } catch (err) {
      console.error(err);
    } finally {
      setRetentionLoading(false);
    }
  }, [retentionInterval, retentionSegment]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [mRes, sRes, eRes, rRes, uRes] = await Promise.all([
        fetch("/api/metrics",    { cache: "no-store" }),
        fetch("/api/signups",    { cache: "no-store" }),
        fetch("/api/engagement", { cache: "no-store" }),
        fetch(`/api/retention?interval=${retentionInterval}&segment=${retentionSegment}`, { cache: "no-store" }),
        fetch("/api/users",      { cache: "no-store" }),
      ]);
      const [m, s, e, r, u] = await Promise.all([
        mRes.json(), sRes.json(), eRes.json(), rRes.json(), uRes.json(),
      ]);
      setMetrics(m);
      setSignups(s);
      setEngagement(e);
      setRetention(r);
      setAllUsers(u?.users ?? []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [retentionInterval, retentionSegment]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(() => fetchAll(true), 120_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // Handle retention switch changes
  const handleIntervalChange = (newIntv: "daily" | "weekly" | "monthly") => {
    setRetentionInterval(newIntv);
    fetchRetention(newIntv, retentionSegment);
  };

  const handleSegmentChange = (newSeg: "all" | "free" | "paid") => {
    setRetentionSegment(newSeg);
    fetchRetention(retentionInterval, newSeg);
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* ── Hero Banner ── */}
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
                    Live Platform Analytics
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Platform Overview</h1>
                <p className="text-white/50 text-sm mt-1.5">Real-time engagement, retention cohorts &amp; user conversion signals</p>
              </div>

              {/* hero summary pills */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <button
                  onClick={() => fetchAll(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
                {[
                  { label: "total accounts",  value: loading ? "—" : (signups?.totalAccounts ?? 0).toLocaleString() },
                  { label: "product users",   value: loading ? "—" : (retention?.neverReturnedAfterUsing?.total ?? 0).toLocaleString() },
                  { label: "active today",    value: loading ? "—" : (engagement?.dau ?? 0).toString(), green: true },
                  { label: "D1 retention",    value: loading ? "—" : `${retention?.rollingDn?.[0] ?? metrics?.retention ?? 0}%` },
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

        {/* ── Row 1: Core KPI Tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard icon={Users}     label="Total Accounts" value={loading ? "—" : (signups?.totalAccounts ?? 0).toLocaleString()} sub="auth.users" accent="default" loading={loading} />
          <StatCard icon={UserCheck} label="Students"       value={loading ? "—" : (signups?.totalStudents ?? 0).toLocaleString()} sub={`${signups?.conversionRate ?? 0}% converted`} accent="indigo" loading={loading} />
          <StatCard icon={Zap}       label="Active Today"   value={loading ? "—" : (engagement?.dau ?? 0)}                        sub="DAU" accent="green" trend="up" loading={loading} />
          <StatCard icon={BookOpen}  label="Questions"      value={loading ? "—" : metrics?.totalQuestionsToday ?? 0}              sub="solved today" accent="indigo" loading={loading} />
          <StatCard icon={Target}    label="Accuracy"       value={loading ? "—" : `${metrics?.accuracyRate ?? 0}%`}               sub="correct today" accent="green" loading={loading} />
          <StatCard icon={Clock}     label="Avg time / Q"   value={loading ? "—" : fmtSeconds(metrics?.avgTimeSec ?? 0)}           sub="today" accent="amber" loading={loading} />
          <StatCard icon={UserPlus}  label="New Today"      value={loading ? "—" : signups?.newSignupsToday ?? 0}                  sub={`${signups?.newSignupsThisWeek ?? 0} this week`} accent="indigo" loading={loading} />
          <StatCard icon={Flame}     label="Avg Streak"     value={loading ? "—" : `${metrics?.avgStreak ?? 0}d`}                  sub={`max ${metrics?.maxStreak ?? 0}d`} accent="amber" loading={loading} />
        </div>

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

        {/* ── Row 2: DAU / WAU / MAU + Stickiness ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Activity}   label="DAU"        value={loading ? "—" : (engagement?.dau ?? 0)} sub="active users today"       accent="green"   loading={loading} />
          <StatCard icon={BarChart2}  label="WAU"        value={loading ? "—" : (engagement?.wau ?? 0)} sub="last 7 days"              accent="indigo"  loading={loading} />
          <StatCard icon={TrendingUp} label="MAU"        value={loading ? "—" : (engagement?.mau ?? 0)} sub="last 30 days"             accent="default" loading={loading} />
          <StatCard icon={Zap}        label="Stickiness" value={loading ? "—" : `${engagement?.stickiness ?? 0}%`} sub="DAU / MAU · engagement depth" accent={(engagement?.stickiness ?? 0) >= 20 ? "green" : "amber"} loading={loading} />
        </div>

        {/* ── Row 3: Daily Active Users (30d) + Signups (30d) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="Daily Active Users — 30 days" icon={Activity} sub="Union of user_activity + attempts + sessions" />
            <SparkBar data={engagement?.dauTimeseries ?? []} valueKey="dau" loading={loading} color="emerald" />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400">{engagement?.dauTimeseries?.[0]?.label ?? ""}</span>
              <span className="text-[10px] text-slate-400">Today</span>
            </div>
          </div>

          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <SectionHeader title="New Signups — 30 days" icon={UserPlus} sub={`${signups?.newSignupsThisWeek ?? 0} this week · ${signups?.newSignupsToday ?? 0} today · ${(signups?.totalAccounts ?? 0).toLocaleString()} total accounts`} />
            <SparkBar data={signups?.signupTimeseries ?? []} valueKey="count" loading={loading} color="indigo" />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400">{signups?.signupTimeseries?.[0]?.label ?? ""}</span>
              <span className="text-[10px] text-slate-400">Today</span>
            </div>
          </div>
        </div>

        {/* ── Row 4: All Chapters Solved Today + Streak Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* All chapters today — scrollable with question counts across chapters */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <SectionHeader
                title="All Chapters Solved Today"
                icon={BookOpen}
                sub={`${metrics?.topChapters?.length ?? 0} chapters active · questions attempted across chapters today`}
              />
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                {metrics?.totalQuestionsToday ?? 0} Qs today
              </span>
            </div>
            {loading ? (
              <div className="p-5 space-y-2.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shimmer h-8 rounded-lg" />
                ))}
              </div>
            ) : (metrics?.topChapters ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <BookOpen size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm font-medium">No activity yet today</p>
                <p className="text-xs text-slate-400 mt-0.5">When students solve questions, chapters will appear here in real time</p>
              </div>
            ) : (
              <div className="p-5 space-y-3 max-h-[440px] overflow-y-auto">
                {(metrics?.topChapters ?? []).map((ch, i) => {
                  const max = metrics?.topChapters?.[0]?.count ?? 1;
                  const pct = Math.round((ch.count / max) * 100);
                  return (
                    <div key={ch.title}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{ch.title}</span>
                          <span className="text-xs text-slate-400 shrink-0 hidden sm:block bg-slate-100 px-1.5 py-0.5 rounded font-medium">{ch.subject}</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 shrink-0 ml-2 tabular-nums">
                          {ch.count} {ch.count === 1 ? "question" : "questions"}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div>
              <SectionHeader title="Streak Stats" icon={Flame} sub="Habitual daily problem solving" />
              {loading ? (
                <div className="space-y-3 mt-3">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
                </div>
              ) : (
                <div className="space-y-3 mt-3">
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
        </div>

        {/* ── Row 5: Never Returned / Churn Analysis (Items 1 & 2) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Item 1: Students who never returned after using product */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <SectionHeader
                  title="Never Returned After 1st Product Use"
                  icon={UserMinus}
                  sub="Active on day 1 only — never returned on any subsequent day"
                />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                  {retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0}% Drop-off
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {retention?.neverReturnedAfterUsing?.neverReturnedCount ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">/ {retention?.neverReturnedAfterUsing?.total ?? 0}</span>
                  </p>
                  <p className="text-xs text-rose-600 font-medium mt-0.5">Left after 1 day ({retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0}%)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {retention?.neverReturnedAfterUsing?.returnedCount ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">/ {retention?.neverReturnedAfterUsing?.total ?? 0}</span>
                  </p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">Came back on Day 2+ ({retention?.neverReturnedAfterUsing?.returnedPct ?? 0}%)</p>
                </div>
              </div>

              {/* Progress bar visual */}
              <div className="mt-3">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-rose-500 transition-all duration-700"
                    style={{ width: `${retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0}%` }}
                    title={`Never returned: ${retention?.neverReturnedAfterUsing?.neverReturnedPct ?? 0}%`}
                  />
                  <div
                    className="bg-emerald-500 transition-all duration-700"
                    style={{ width: `${retention?.neverReturnedAfterUsing?.returnedPct ?? 0}%` }}
                    title={`Returned: ${retention?.neverReturnedAfterUsing?.returnedPct ?? 0}%`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowProductDropoff(!showProductDropoff)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 transition py-1"
              >
                <span>{showProductDropoff ? "Hide" : "View"} drop-off student list</span>
                {showProductDropoff ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showProductDropoff && (
                <div className="mt-3 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {(retention?.neverReturnedAfterUsing?.sampleUsers ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No drop-off students found</p>
                  ) : (
                    (retention?.neverReturnedAfterUsing?.sampleUsers ?? []).map((u) => (
                      <div key={u.userId} className="py-2.5 flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="amber" />
                          <div className="min-w-0">
                            <Link href={`/users/${u.userId}`} className="font-semibold text-slate-800 truncate hover:text-indigo-600 hover:underline block">
                              {u.name}
                            </Link>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || "No email"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-medium text-slate-600 block">{u.questionsCount} Qs solved</span>
                          <span className="text-[10px] text-slate-400">{u.onlyActiveDate}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Item 2: Students who never returned after sign up */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <SectionHeader
                  title="Never Returned After Sign Up"
                  icon={UserX}
                  sub="Signed up but had 0 activity, or bounced on signup day"
                />
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                  {retention?.neverReturnedAfterSignup?.neverReturnedPct ?? 0}% Drop-off
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div>
                  <p className="text-xl font-bold text-slate-800">{retention?.neverReturnedAfterSignup?.neverReturnedCount ?? 0}</p>
                  <p className="text-[11px] text-rose-600 font-medium mt-0.5">Total left ({retention?.neverReturnedAfterSignup?.neverReturnedPct ?? 0}%)</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-600">{retention?.neverReturnedAfterSignup?.zeroActivityCount ?? 0}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">0 Qs solved ({retention?.neverReturnedAfterSignup?.zeroActivityPct ?? 0}%)</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-700">{retention?.neverReturnedAfterSignup?.day1OnlyCount ?? 0}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Day 1 bounce ({retention?.neverReturnedAfterSignup?.day1OnlyPct ?? 0}%)</p>
                </div>
              </div>

              {/* Progress bar visual */}
              <div className="mt-3">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-red-500 transition-all duration-700"
                    style={{ width: `${retention?.neverReturnedAfterSignup?.zeroActivityPct ?? 0}%` }}
                    title={`Zero activity: ${retention?.neverReturnedAfterSignup?.zeroActivityPct ?? 0}%`}
                  />
                  <div
                    className="bg-amber-400 transition-all duration-700"
                    style={{ width: `${retention?.neverReturnedAfterSignup?.day1OnlyPct ?? 0}%` }}
                    title={`Day 1 bounce: ${retention?.neverReturnedAfterSignup?.day1OnlyPct ?? 0}%`}
                  />
                  <div
                    className="bg-emerald-500 transition-all duration-700"
                    style={{ width: `${retention?.neverReturnedAfterSignup?.returnedPct ?? 0}%` }}
                    title={`Returned: ${retention?.neverReturnedAfterSignup?.returnedPct ?? 0}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>{retention?.neverReturnedAfterSignup?.zeroActivityCount ?? 0} ghost signups</span>
                  <span>{retention?.neverReturnedAfterSignup?.returnedCount ?? 0} retained accounts</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSignupDropoff(!showSignupDropoff)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 transition py-1"
              >
                <span>{showSignupDropoff ? "Hide" : "View"} drop-off signup list</span>
                {showSignupDropoff ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showSignupDropoff && (
                <div className="mt-3 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {(retention?.neverReturnedAfterSignup?.sampleUsers ?? []).length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No drop-off signups found</p>
                  ) : (
                    (retention?.neverReturnedAfterSignup?.sampleUsers ?? []).map((u) => (
                      <div key={u.userId} className="py-2.5 flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="indigo" />
                          <div className="min-w-0">
                            <Link href={`/users/${u.userId}`} className="font-semibold text-slate-800 truncate hover:text-indigo-600 hover:underline block">
                              {u.name}
                            </Link>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || "No email"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.activityType === "zero_activity" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                            {u.activityType === "zero_activity" ? "Zero Activity" : "Day 1 Only"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{u.signupAt ? new Date(u.signupAt).toLocaleDateString("en-IN") : "—"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Cohort Retention with Interval & Segment Switches (Item 4) ── */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <SectionHeader
                title={`Cohort Retention — ${retentionInterval === "weekly" ? "Weekly (W1–W8)" : retentionInterval === "monthly" ? "Monthly (M1–M6)" : "Daily (D1–D7)"}`}
                icon={Repeat2}
                sub={`% of ${retentionSegment === "paid" ? "PAID" : retentionSegment === "free" ? "FREE" : "ALL"} users who returned in subsequent periods`}
              />
            </div>

            {/* Interactive Switches: Interval and Free/Paid Segment */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Interval Switch */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
                {(["daily", "weekly", "monthly"] as const).map((intv) => (
                  <button
                    key={intv}
                    onClick={() => handleIntervalChange(intv)}
                    className={`px-3 py-1 rounded-md capitalize transition ${retentionInterval === intv ? "bg-white text-slate-900 font-bold shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {intv}
                  </button>
                ))}
              </div>

              {/* Free vs Paid Segment Switch */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
                {(["all", "free", "paid"] as const).map((seg) => (
                  <button
                    key={seg}
                    onClick={() => handleSegmentChange(seg)}
                    className={`px-3 py-1 rounded-md capitalize transition ${retentionSegment === seg ? "bg-emerald-600 text-white font-bold shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {seg === "all" ? "All Users" : seg === "free" ? "Free Users" : "Paid Users"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rolling average pill row */}
          <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Average Retention:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(retention?.rollingDn ?? []).map((pct, i) => (
                <span
                  key={i}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${pctBg(pct)} ${pctColor(pct)} border-current/20`}
                >
                  {retention?.headers?.[i] ?? `D${i + 1}`}: {pct !== null ? `${pct}%` : "—"}
                </span>
              ))}
            </div>
          </div>

          <div className="p-5">
            <CohortHeatmap
              rows={retention?.cohortTable ?? []}
              headers={retention?.headers}
              loading={retentionLoading || loading}
            />
          </div>
        </div>

        {/* ── Row 4: Repeat Platform Usage (Item 6) + Monthly Retention ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Repeat usage distribution */}
          <div className="md:col-span-2 bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]">
            <div className="flex items-start justify-between mb-4">
              <SectionHeader
                title="Platform Repeat Usage"
                icon={Repeat2}
                sub="Distribution of how many distinct days students return and practice"
              />
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                {retention?.repeatPlatformUsage?.repeatRate ?? 0}% Repeat Users
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {(retention?.repeatPlatformUsage?.distribution ?? []).map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className="text-slate-700 font-semibold">{item.label}</span>
                    <span className="text-slate-500 tabular-nums">
                      <b>{item.count}</b> students ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${item.days === 1 ? "bg-slate-300" : "bg-emerald-500"}`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly retention card */}
          <div className="bg-white rounded-[14px] border border-slate-200 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div>
              <SectionHeader title="Monthly Retention" icon={TrendingUp} sub="Last month active returning this month" />
              <div className="my-5 flex flex-col items-center justify-center gap-2">
                <RetentionRing pct={retention?.monthlyRetention ?? 0} loading={loading} />
                <p className="text-xs text-slate-500 text-center mt-2">
                  <b>{retention?.monthlyRetained ?? 0}</b> of {retention?.lastMonthActiveUsers ?? 0} users retained
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-slate-800">{retention?.lastMonthActiveUsers ?? 0}</p>
                <p className="text-xs text-slate-400">Last month</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{retention?.thisMonthActiveUsers ?? 0}</p>
                <p className="text-xs text-slate-400">This month</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 5: Users Who Exceeded 3-Question Daily Limit (Item 5) ── */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <SectionHeader
                title="Daily Limit Exceeded (> 3 Questions) &amp; High-Volume Solvers"
                icon={Flame}
                sub={`${metrics?.limitExceededUsers?.exceededCount ?? 0} students reached the 3-question free limit and kept practicing`}
              />
            </div>
            {/* Kept solving pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                4–5 Qs: {metrics?.limitExceededUsers?.keptSolvingBuckets?.q4to5 ?? 0}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                6–10 Qs: {metrics?.limitExceededUsers?.keptSolvingBuckets?.q6to10 ?? 0}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                11–20 Qs: {metrics?.limitExceededUsers?.keptSolvingBuckets?.q11to20 ?? 0}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                21+ Qs: {metrics?.limitExceededUsers?.keptSolvingBuckets?.q21plus ?? 0}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shimmer h-12 rounded-lg" />
              ))}
            </div>
          ) : (metrics?.limitExceededUsers?.users ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Flame size={28} strokeWidth={1.4} />
              <p className="mt-2 text-sm">No users have exceeded the 3-question limit yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-5">Student</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Max Qs in 1 Day</th>
                    <th className="py-2.5 px-3 text-center">Total Qs Solved</th>
                    <th className="py-2.5 px-3 text-center">Days Limit Exceeded</th>
                    <th className="py-2.5 px-5 text-right">Last Exceeded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(metrics?.limitExceededUsers?.users ?? []).map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="emerald" />
                          <div className="min-w-0">
                            <Link href={`/users/${u.userId}`} className="font-semibold text-slate-900 truncate hover:text-indigo-600 hover:underline block">
                              {u.name}
                            </Link>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || u.userId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] ${u.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {u.isPaid ? "Paid Pass" : "Free User"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 text-sm">
                        {u.maxInSingleDay}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-600">
                        {u.totalAnswered}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-indigo-600">
                        {u.daysExceededCount} {u.daysExceededCount === 1 ? "day" : "days"}
                      </td>
                      <td className="py-3 px-5 text-right text-slate-400">
                        {u.lastExceededDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Row 6: Multiple Checkout Openers (Item 3) ── */}
        <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <SectionHeader
                title="Multiple Checkout Openers (High Purchase Intent)"
                icon={ShoppingCart}
                sub={`${metrics?.multipleCheckoutUsers?.multiOpenersCount ?? 0} students opened Razorpay checkout 2 or more times`}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {metrics?.multipleCheckoutUsers?.convertedCount ?? 0} Converted
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                {metrics?.multipleCheckoutUsers?.abandonedCount ?? 0} Abandoned (Potential Leads)
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shimmer h-12 rounded-lg" />
              ))}
            </div>
          ) : (metrics?.multipleCheckoutUsers?.users ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShoppingCart size={28} strokeWidth={1.4} />
              <p className="mt-2 text-sm">No multiple checkout openers recorded</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-5">Student</th>
                    <th className="py-2.5 px-3 text-center">Times Checkout Opened</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Plan Attempted</th>
                    <th className="py-2.5 px-5 text-right">Last Checkout Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(metrics?.multipleCheckoutUsers?.users ?? []).map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="indigo" />
                          <div className="min-w-0">
                            <Link href={`/users/${u.userId}`} className="font-semibold text-slate-900 truncate hover:text-indigo-600 hover:underline block">
                              {u.name}
                            </Link>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || u.userId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-800 text-sm bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {u.checkoutCount} times
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${u.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          {u.status === "paid" ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {u.status === "paid" ? "Paid" : "Abandoned Checkout"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {u.planId}
                      </td>
                      <td className="py-3 px-5 text-right text-slate-400">
                        {u.lastCheckoutAt ? timeAgo(u.lastCheckoutAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Row 7: Power Users & Recent Active Students ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Top retained power users */}
          <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader
                title="Power Users — Last 7 Days"
                icon={Award}
                sub="Students active on 5 or more of the last 7 days"
              />
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}
              </div>
            ) : (retention?.topRetainedUsers ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Award size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No power users active 5+ days this week</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                {(retention?.topRetainedUsers ?? []).map((u, i) => (
                  <Link
                    key={u.userId}
                    href={`/users/${u.userId}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition group cursor-pointer"
                  >
                    <span className="w-5 text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="violet" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition">
                        {u.name}
                      </p>
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
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recently Active Students */}
          <div className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <SectionHeader title="Recently Active Students" icon={Zap} sub="Real-time activity from latest sessions · click student to view profile" />
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-10 rounded" />)}
              </div>
            ) : (metrics?.recentUsers ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Users size={28} strokeWidth={1.4} />
                <p className="mt-2 text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                {(metrics?.recentUsers ?? []).map((u) => (
                  <Link
                    key={u.userId}
                    href={`/users/${u.userId}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition group cursor-pointer"
                  >
                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="emerald" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-emerald-700 transition">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{u.subject} — {u.chapter}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400">{timeAgo(u.lastSeen)}</span>
                      <span className="text-xs text-slate-300 group-hover:text-emerald-600 transition">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 8: All Registered Students Directory ── */}
        <section className="bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <SectionHeader
                title="All Registered Students"
                icon={Users}
                sub={`${allUsers.length} total students on Rookie · click any student to inspect individual performance`}
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search student or email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-48 sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(["all", "active", "paid", "free", "new"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setUserFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition capitalize ${
                      userFilter === tab
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab === "all" ? "All" : tab === "active" ? "Active" : tab === "paid" ? "Paid" : tab === "free" ? "Free" : "New (<24h)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {(() => {
            const filteredUsers = allUsers.filter((u) => {
              if (userSearch) {
                const q = userSearch.toLowerCase();
                const matches = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
                if (!matches) return false;
              }
              if (userFilter === "active") return u.totalAttempts > 0;
              if (userFilter === "paid") return u.isPaid;
              if (userFilter === "free") return !u.isPaid;
              if (userFilter === "new") return u.isNew;
              return true;
            });

            if (filteredUsers.length === 0) {
              return (
                <div className="p-12 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No students match your search</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-5">Student</th>
                      <th className="py-2.5 px-3">Class &amp; Exam</th>
                      <th className="py-2.5 px-3 text-center">Questions Attempted</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Last Active</th>
                      <th className="py-2.5 px-5 text-right">Registered</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.slice(0, 150).map((u) => (
                      <tr key={u.userId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-5">
                          <Link href={`/users/${u.userId}`} className="flex items-center gap-2.5 group">
                            <UserAvatar name={u.name} avatarUrl={u.avatarUrl} gradient="emerald" />
                            <div className="min-w-0 max-w-[200px]">
                              <p className="font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition">
                                {u.name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">{u.email || u.userId.slice(0, 8)}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-700 font-medium">{u.class}</span>
                          <span className="text-[11px] text-slate-400 block">{u.exam}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-bold tabular-nums text-sm ${u.totalAttempts > 0 ? "text-slate-900" : "text-slate-300"}`}>
                            {u.totalAttempts}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {u.isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                              <Crown size={10} className="text-amber-500 fill-amber-500" />
                              Paid Pass
                            </span>
                          ) : u.isNew ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] bg-sky-100 text-sky-800">
                              New (&lt;24h)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium text-[10px] bg-slate-100 text-slate-600">
                              Free User
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {timeAgo(u.lastSeen)}
                        </td>
                        <td className="py-3 px-5 text-right text-slate-400 whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            href={`/users/${u.userId}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>

        {/* ── Footer ── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pb-4 pt-2 border-t border-slate-200">
          <span>Last refreshed: {lastRefresh.toLocaleTimeString("en-IN")}</span>
          <div className="flex items-center gap-3">
            <span>Auto-refreshes every 2 min</span>
            <a
              href="/api/export"
              download="rookie-analytics.csv"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download CSV
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
}

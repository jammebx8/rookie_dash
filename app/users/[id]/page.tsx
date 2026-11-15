"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BookOpen,
  Award,
  Crown,
  ShoppingCart,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  FileText,
  User,
  Zap,
  Tag,
  Key,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface UserDetailData {
  profile: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    class: string;
    exam: string;
    rookieCoins: number;
    createdAt: string;
    lastSeen: string;
  };
  pass: {
    isPaid: boolean;
    planId: string;
    accessUntil: string | null;
  };
  salePricing?: {
    basePrice: number;
    effectivePrice: number;
    saleType: "custom" | "welcome" | "none";
    activeCustomSale?: {
      customPrice: number;
      customPricePaise: number;
      expiresAt: string;
      durationHours: number;
      reason: string;
      remainingMs: number;
    } | null;
    welcomeSale: {
      isActive: boolean;
      expiresAt: string;
      remainingMs: number;
      remainingHours: number;
    };
  };
  kpis: {
    totalAttempts: number;
    totalCorrect: number;
    accuracyRate: number;
    avgTimeSec: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    totalTests: number;
    totalOrders: number;
  };
  recentAttempts: {
    id: number;
    questionId: string;
    correct: boolean;
    timeTakenSec: number;
    createdAt: string;
  }[];
  chapters: {
    chapter: string;
    subject: string;
    count: number;
    correct: number;
    accuracy: number;
    lastAttempted: string;
  }[];
  tests: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
  orders: {
    id: string;
    planId: string;
    amount: number;
    status: string;
    createdAt: string;
    paidAt: string | null;
  }[];
  error?: string;
}

const CARD = "bg-white dark:bg-[#1b1e22] rounded-[16px] border border-[#ecebe8] dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

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

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) return email.slice(0, 2).toUpperCase();
  return "U";
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom sale management states
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [customPrice, setCustomPrice] = useState("399");
  const [durationHours, setDurationHours] = useState("24");
  const [customReason, setCustomReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleMessage, setSaleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const reloadUser = async () => {
    try {
      const res = await fetch(`/api/users/${id}`, { cache: "no-store" });
      setData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleGrantCustomSale = async () => {
    if (!adminPassword.trim()) {
      setSaleMessage({ type: "error", text: "Please enter the admin password." });
      return;
    }
    setSubmittingSale(true);
    setSaleMessage(null);
    try {
      const res = await fetch("/api/custom-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: id,
          customPrice: Number(customPrice),
          durationHours: Number(durationHours),
          adminPassword,
          reason: customReason || `Custom sale (₹${customPrice} for ${durationHours}h)`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaleMessage({ type: "error", text: json.error || "Failed to activate custom sale" });
      } else {
        setSaleMessage({
          type: "success",
          text: `🎉 Custom sale activated! Price is now ₹${customPrice} for ${durationHours} hours on Rookie.AI and Razorpay checkout.`,
        });
        setShowSaleModal(false);
        setAdminPassword("");
        await reloadUser();
      }
    } catch (err) {
      setSaleMessage({ type: "error", text: String(err) });
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleCancelCustomSale = async () => {
    if (!adminPassword.trim()) {
      setSaleMessage({ type: "error", text: "Please enter the admin password." });
      return;
    }
    setSubmittingSale(true);
    setSaleMessage(null);
    try {
      const res = await fetch("/api/custom-sale", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: id,
          adminPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaleMessage({ type: "error", text: json.error || "Failed to cancel custom sale" });
      } else {
        setSaleMessage({
          type: "success",
          text: "Custom sale cancelled. Pricing has reverted to standard base price (₹999).",
        });
        setShowCancelModal(false);
        setAdminPassword("");
        await reloadUser();
      }
    } catch (err) {
      setSaleMessage({ type: "error", text: String(err) });
    } finally {
      setSubmittingSale(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/users/${id}`, { cache: "no-store" });
        setData(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading student profile…</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-6 max-w-4xl mx-auto space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0f172a] dark:text-[#cbd5e1] dark:hover:text-white transition"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <div className="p-8 bg-white dark:bg-[#1b1e22] rounded-[16px] border border-red-200 dark:border-rose-900/40 text-center">
          <p className="text-base font-bold text-red-600 dark:text-rose-400">Student Not Found</p>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{data?.error || "User could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const { profile, pass, kpis, recentAttempts, chapters, tests, orders } = data;

  return (
    <div className="min-h-screen bg-[#f8f8f7] dark:bg-[#0f1115] text-[#0f172a] dark:text-[#f8fafc]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">

        {/* ── Back Navigation ── */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-[#ffffff] bg-white dark:bg-[#1b1e22] border border-[#ecebe8] dark:border-white/10 px-3 py-1.5 rounded-[8px] shadow-sm transition hover:bg-[#f8f8f7] dark:hover:bg-white/5"
          >
            <ArrowLeft size={13} />
            Back to Dashboard
          </Link>
        </div>

        {/* ── Header Card ── */}
        <section className={`${CARD} p-6`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-indigo-600 text-white text-xl font-bold flex items-center justify-center shrink-0 shadow-sm">
                  {getInitials(profile.name, profile.email)}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                    {profile.name}
                  </h1>
                  {pass.isPaid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Crown size={12} className="text-amber-500 fill-amber-500" />
                      Paid Pass Holder
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Free User
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mt-1 truncate">
                  {profile.email || "No email on record"} · ID: <code className="font-mono text-slate-600">{profile.id}</code>
                </p>

                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                  {profile.class !== "—" && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                      Class: {profile.class}
                    </span>
                  )}
                  {profile.exam !== "—" && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                      Target: {profile.exam}
                    </span>
                  )}
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    🪙 {profile.rookieCoins} Coins
                  </span>
                  <span>Registered: {new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span>Last active: <strong className="text-slate-700">{timeAgo(profile.lastSeen)}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Custom Sale & Account Pricing ── */}
        <section className={`${CARD} p-6 border-[#e3f1ff] dark:border-white/10 bg-gradient-to-br from-white via-[#f3f9ff] to-[#fcf5f2] dark:from-[#1b1e22] dark:via-[#16181c] dark:to-[#1b1e22]`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[8px] bg-[#1F75FE] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Zap size={20} className="fill-[#ffd84d] text-[#ffd84d]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[#2e2e2e] dark:text-[#f3f5fa]">
                    Account Pricing &amp; Sale Status
                  </h2>
                  {data.salePricing?.activeCustomSale ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-[#fff1f4] text-[#ff4f7b] border border-[#f7cdc8] dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/40">
                      <Sparkles size={11} className="text-[#ff4f7b]" />
                      Custom Sale Active · ₹{data.salePricing.activeCustomSale.customPrice}
                    </span>
                  ) : data.salePricing?.welcomeSale?.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[6px] text-xs font-bold bg-[#e3f1ff] text-[#2a6fb5] border border-[#c9e5ff] dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800/40">
                      <Clock size={11} className="text-[#2a6fb5]" />
                      48h Welcome Sale Active (60% OFF) · ₹399
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-xs font-semibold bg-[#f1f1ef] text-[#55514e] border border-[#ecebe8] dark:bg-white/10 dark:text-[#b6bbc5] dark:border-white/10">
                      Base Price · ₹999
                    </span>
                  )}
                </div>

                <div className="text-xs text-[#55514e] dark:text-[#b6bbc5] mt-1 space-y-0.5">
                  <p>
                    Effective price on platform &amp; Razorpay checkout:{" "}
                    <strong className="text-[#2e2e2e] dark:text-[#f3f5fa] font-bold text-sm">₹{data.salePricing?.effectivePrice ?? 999}</strong>
                    <span className="text-[#736d68] dark:text-[#868c97] ml-1">/ year (Base: ₹999)</span>
                  </p>

                  {data.salePricing?.activeCustomSale && (
                    <p className="text-[#ff4f7b] dark:text-rose-400 font-medium">
                      ⏱️ Sale expires in{" "}
                      <strong>
                        {Math.floor(data.salePricing.activeCustomSale.remainingMs / 3600000)}h{" "}
                        {Math.floor((data.salePricing.activeCustomSale.remainingMs % 3600000) / 60000)}m
                      </strong>{" "}
                      ({new Date(data.salePricing.activeCustomSale.expiresAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}) · <em>&quot;{data.salePricing.activeCustomSale.reason}&quot;</em>
                    </p>
                  )}

                  {!data.salePricing?.activeCustomSale && data.salePricing?.welcomeSale?.isActive && (
                    <p className="text-[#059669] dark:text-emerald-400 font-medium">
                      ⏱️ 48-hour new signup timer:{" "}
                      <strong>{data.salePricing.welcomeSale.remainingHours}h remaining</strong>{" "}
                      until {new Date(data.salePricing.welcomeSale.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
                      Price automatically flips to ₹999 when timer reaches zero.
                    </p>
                  )}

                  {!data.salePricing?.activeCustomSale && !data.salePricing?.welcomeSale?.isActive && (
                    <p className="text-[#736d68] dark:text-[#868c97]">
                      48-hour welcome timer has expired. This student currently pays the base annual price of ₹999.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {data.salePricing?.activeCustomSale && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-1.5 rounded-[8px] border border-[#f7cdc8] dark:border-rose-900 bg-[#fff1f4] dark:bg-rose-950/60 text-[#ff4f7b] dark:text-rose-300 hover:bg-[#fdecea] text-xs font-semibold transition"
                >
                  Cancel Custom Sale
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSaleModal(true);
                  setSaleMessage(null);
                }}
                className="px-4 py-2 rounded-[8px] bg-[#1F75FE] hover:bg-[#163a60] text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
              >
                <Zap size={14} className="fill-current" />
                {data.salePricing?.activeCustomSale ? "Update Custom Sale" : "Put on Custom Sale"}
              </button>
            </div>
          </div>

          {saleMessage && (
            <div
              className={`mt-3 p-3 rounded-[8px] text-xs font-medium flex items-center justify-between ${
                saleMessage.type === "success"
                  ? "bg-[#dcf5e7] text-[#178a51] border border-[#4fc787] dark:bg-emerald-950/70 dark:text-emerald-300"
                  : "bg-[#fff1f4] text-[#ff4f7b] border border-[#e7a39b] dark:bg-rose-950/70 dark:text-rose-300"
              }`}
            >
              <span>{saleMessage.text}</span>
              <button onClick={() => setSaleMessage(null)} className="text-[#736d68] hover:text-[#2e2e2e] dark:hover:text-white font-bold ml-2">
                ✕
              </button>
            </div>
          )}
        </section>

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`${CARD} p-4`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <BookOpen size={14} className="text-indigo-500" />
              <span>Questions Attempted</span>
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.totalAttempts.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kpis.totalCorrect} correct · {kpis.accuracyRate}% accuracy
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Target size={14} className="text-emerald-500" />
              <span>Accuracy Rate</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 tabular-nums">
              {kpis.accuracyRate}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Avg time: {kpis.avgTimeSec}s / question
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Calendar size={14} className="text-sky-500" />
              <span>Active Days & Streak</span>
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.activeDays} <span className="text-xs font-normal text-slate-400">days</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Current streak: {kpis.currentStreak}d · Longest: {kpis.longestStreak}d
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <FileText size={14} className="text-violet-500" />
              <span>Custom Tests Taken</span>
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              {kpis.totalTests}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kpis.totalOrders} checkout orders started
            </p>
          </div>
        </div>

        {/* ── Chapters Practiced ── */}
        <section className={`${CARD} overflow-hidden`}>
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Chapters Studied ({chapters.length})
              </h2>
            </div>
          </div>

          {chapters.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No chapter activity recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8f8f7] dark:bg-[#16181c] text-[#475569] dark:text-[#cbd5e1] border-b border-[#ecebe8] dark:border-white/10 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-5">Chapter</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3 text-center">Questions</th>
                    <th className="py-2.5 px-3 text-center">Correct</th>
                    <th className="py-2.5 px-3 text-center">Accuracy</th>
                    <th className="py-2.5 px-5 text-right">Last Attempted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ecebe8] dark:divide-white/10">
                  {chapters.map((ch) => (
                    <tr key={ch.chapter} className="hover:bg-[#f8f8f7]/80 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-2.5 px-5 font-bold text-[#0f172a] dark:text-[#ffffff]">{ch.chapter}</td>
                      <td className="py-2.5 px-3 text-[#475569] dark:text-[#cbd5e1] capitalize font-medium">{ch.subject}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#0f172a] dark:text-[#ffffff]">{ch.count}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{ch.correct}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#334155] dark:text-[#cbd5e1]">{ch.accuracy}%</td>
                      <td className="py-2.5 px-5 text-right text-[#64748b] dark:text-[#94a3b8]">{timeAgo(ch.lastAttempted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Recent Attempts Stream (Append-Only Log) ── */}
        <section className={`${CARD} overflow-hidden`}>
          <div className="px-5 pt-5 pb-3 border-b border-[#ecebe8] dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-emerald-500" />
              <h2 className="text-sm font-bold text-[#0f172a] dark:text-[#ffffff] uppercase tracking-wide">
                Recent Question Attempts Stream ({recentAttempts.length})
              </h2>
            </div>
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-medium">Append-only live log</span>
          </div>

          {recentAttempts.length === 0 ? (
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] py-8 text-center font-medium">No question attempts recorded</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8f8f7] dark:bg-[#16181c] text-[#475569] dark:text-[#cbd5e1] border-b border-[#ecebe8] dark:border-white/10 uppercase text-[10px] font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-5">Result</th>
                    <th className="py-2.5 px-3">Question ID</th>
                    <th className="py-2.5 px-3">Time Taken</th>
                    <th className="py-2.5 px-5 text-right">Attempted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-5">
                        {a.correct ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                            <CheckCircle size={10} /> Correct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-800">
                            <XCircle size={10} /> Incorrect
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        {a.questionId ? `${a.questionId.slice(0, 12)}…` : "—"}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-medium">
                        {a.timeTakenSec ? `${a.timeTakenSec}s` : "—"}
                      </td>
                      <td className="py-2 px-5 text-right text-slate-400 whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Custom Tests & Orders ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Custom Tests */}
          <section className={`${CARD} overflow-hidden`}>
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText size={15} className="text-violet-500" />
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Custom Tests ({tests.length})
              </h2>
            </div>
            {tests.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No custom tests taken</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {tests.map((t) => (
                  <div key={t.id} className="p-3 px-5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{t.title}</p>
                      <p className="text-[11px] text-slate-400">{timeAgo(t.createdAt)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Orders / Checkout History */}
          <section className={`${CARD} overflow-hidden`}>
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <ShoppingCart size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Checkout & Pass Orders ({orders.length})
              </h2>
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No checkout attempts initiated</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {orders.map((o) => (
                  <div key={o.id} className="p-3 px-5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{o.planId}</p>
                      <p className="text-[11px] text-slate-400">₹{o.amount} · {timeAgo(o.createdAt)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      o.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {o.status === "paid" ? "Paid" : "Abandoned"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Custom Sale Modal ── */}
        {showSaleModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1b1e22] rounded-[16px] max-w-md w-full p-6 shadow-2xl border border-[#ecebe8] dark:border-white/10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#0f172a] dark:text-[#ffffff] flex items-center gap-2">
                    <span className="p-1 rounded-[6px] bg-[#fff1f4] text-[#ff4f7b] dark:bg-rose-950/70 dark:text-rose-300">
                      <Zap size={16} className="fill-current" />
                    </span>
                    Put {profile.name} on Sale
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Sets a custom price and countdown timer for this student on Rookie.AI and in Razorpay checkout
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="p-1 rounded-[6px] text-[#64748b] hover:bg-[#f1f1ef] dark:text-[#94a3b8] dark:hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              {/* Price field */}
              <div>
                <label className="text-xs font-semibold text-[#0f172a] dark:text-[#ffffff] block mb-1">
                  Custom Discounted Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8] font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="399"
                    className="w-full pl-7 pr-3 py-2 rounded-[8px] border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-sm font-bold text-[#0f172a] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#1F75FE]/30"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">Presets:</span>
                  {["199", "299", "399", "499"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCustomPrice(p)}
                      className={`text-[11px] px-2.5 py-1 rounded-[6px] font-bold border transition ${
                        customPrice === p
                          ? "bg-[#1F75FE] text-white border-[#1F75FE] shadow-sm"
                          : "bg-[#f8f8f7] dark:bg-white/5 text-[#334155] dark:text-[#cbd5e1] border-[#ecebe8] dark:border-white/10 hover:bg-[#f1f1ef]"
                      }`}
                    >
                      ₹{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration field */}
              <div>
                <label className="text-xs font-semibold text-[#0f172a] dark:text-[#ffffff] block mb-1">
                  Sale Duration
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: "24 Hours", hours: "24" },
                    { label: "2 Days (48h)", hours: "48" },
                    { label: "3 Days (72h)", hours: "72" },
                    { label: "7 Days", hours: "168" },
                  ].map((d) => (
                    <button
                      key={d.hours}
                      type="button"
                      onClick={() => setDurationHours(d.hours)}
                      className={`text-[11px] p-2 rounded-[8px] font-bold border text-center transition ${
                        durationHours === d.hours
                          ? "bg-[#1F75FE] text-white border-[#1F75FE] shadow-sm"
                          : "bg-[#f8f8f7] dark:bg-white/5 text-[#334155] dark:text-[#cbd5e1] border-[#ecebe8] dark:border-white/10 hover:bg-[#f1f1ef]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Custom hours:</span>
                  <input
                    type="number"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="w-20 px-2 py-1 rounded-[6px] border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-xs font-medium text-[#0f172a] dark:text-[#ffffff]"
                    min="1"
                    max="720"
                  />
                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">hours from now</span>
                </div>
              </div>

              {/* Reason / Note */}
              <div>
                <label className="text-xs font-semibold text-[#0f172a] dark:text-[#ffffff] block mb-1">
                  Reason / Campaign Note
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="e.g. Abandoned checkout lead / Special discount"
                  className="w-full px-3 py-2 rounded-[8px] border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-xs text-[#0f172a] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#1F75FE]/30"
                />
              </div>

              {/* Admin Password */}
              <div className="pt-1">
                <label className="text-xs font-semibold text-[#0f172a] dark:text-[#ffffff] block mb-1">
                  Admin Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-3 py-2 rounded-[8px] border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-xs text-[#0f172a] dark:text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#1F75FE]/30 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#ecebe8] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="px-3.5 py-1.5 rounded-[8px] text-xs font-medium text-[#64748b] hover:bg-[#f1f1ef] dark:text-[#cbd5e1] dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGrantCustomSale}
                  disabled={submittingSale || !adminPassword.trim()}
                  className="px-4 py-2 rounded-[8px] bg-[#ff4f7b] hover:bg-[#e03d67] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  {submittingSale ? "Activating…" : `Activate ₹${customPrice} Sale`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Cancel Custom Sale Modal ── */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1b1e22] rounded-[16px] max-w-sm w-full p-5 shadow-2xl border border-[#ecebe8] dark:border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#ffffff]">Cancel Custom Sale</h3>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Are you sure you want to cancel the custom discount for {profile.name}? Price will immediately revert to standard base price (₹999).
              </p>
              <div>
                <label className="text-xs font-semibold text-[#0f172a] dark:text-[#ffffff] block mb-1">Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-3 py-2 rounded-[8px] border border-[#ecebe8] dark:border-white/10 bg-[#f8f8f7] dark:bg-white/5 text-xs text-[#0f172a] dark:text-[#ffffff] font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ecebe8] dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 rounded-[8px] text-xs font-medium text-[#64748b] hover:bg-[#f1f1ef] dark:text-[#cbd5e1] dark:hover:bg-white/10 transition"
                >
                  Keep Sale
                </button>
                <button
                  type="button"
                  onClick={handleCancelCustomSale}
                  disabled={submittingSale || !adminPassword.trim()}
                  className="px-3.5 py-1.5 rounded-[8px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition"
                >
                  {submittingSale ? "Cancelling…" : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

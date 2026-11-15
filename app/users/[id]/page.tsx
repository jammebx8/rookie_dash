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

const CARD = "bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]";

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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <div className="p-8 bg-white rounded-xl border border-red-200 text-center">
          <p className="text-base font-bold text-red-600">Student Not Found</p>
          <p className="text-xs text-slate-400 mt-1">{data?.error || "User could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const { profile, pass, kpis, recentAttempts, chapters, tests, orders } = data;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">

        {/* ── Back Navigation ── */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition hover:bg-slate-50"
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
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-5">Chapter</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3 text-center">Questions</th>
                    <th className="py-2.5 px-3 text-center">Correct</th>
                    <th className="py-2.5 px-3 text-center">Accuracy</th>
                    <th className="py-2.5 px-5 text-right">Last Attempted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chapters.map((ch) => (
                    <tr key={ch.chapter} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-5 font-semibold text-slate-800">{ch.chapter}</td>
                      <td className="py-2.5 px-3 text-slate-500 capitalize">{ch.subject}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">{ch.count}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-medium">{ch.correct}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{ch.accuracy}%</td>
                      <td className="py-2.5 px-5 text-right text-slate-400">{timeAgo(ch.lastAttempted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Recent Attempts Stream (Append-Only Log) ── */}
        <section className={`${CARD} overflow-hidden`}>
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                Recent Question Attempts Stream ({recentAttempts.length})
              </h2>
            </div>
            <span className="text-xs text-slate-400">Append-only live log</span>
          </div>

          {recentAttempts.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No question attempts recorded</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px] sticky top-0">
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

      </main>
    </div>
  );
}

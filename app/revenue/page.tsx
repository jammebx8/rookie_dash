"use client";

import { DollarSign, TrendingUp, Users, CreditCard, BarChart2, Lock } from "lucide-react";

const CARD = "bg-white rounded-[14px] border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.05)]";

function ZeroStatCard({
  icon: Icon, label, sub, accent = "slate",
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  accent?: "emerald" | "indigo" | "violet" | "amber" | "slate";
}) {
  const accentMap = {
    emerald: { bg: "bg-emerald-50", ring: "border-emerald-100", icon: "text-emerald-500" },
    indigo:  { bg: "bg-indigo-50",  ring: "border-indigo-100",  icon: "text-indigo-500"  },
    violet:  { bg: "bg-violet-50",  ring: "border-violet-100",  icon: "text-violet-500"  },
    amber:   { bg: "bg-amber-50",   ring: "border-amber-100",   icon: "text-amber-500"   },
    slate:   { bg: "bg-slate-50",   ring: "border-slate-100",   icon: "text-slate-400"   },
  };
  const c = accentMap[accent];
  return (
    <div className={`${CARD} p-5`}>
      <div className={`w-10 h-10 rounded-xl border ${c.bg} ${c.ring} flex items-center justify-center mb-4`}>
        <Icon size={18} className={c.icon} strokeWidth={1.8} />
      </div>
      <p className="text-2xl font-bold text-slate-400 leading-none">₹ 0</p>
      <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default function RevenuePage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Revenue</h1>
            <p className="text-sm text-slate-500 mt-0.5">{today}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-500">
            <Lock size={11} strokeWidth={2} />
            No data yet
          </span>
        </div>

        {/* Zero-state notice */}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <DollarSign size={32} className="text-slate-300" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-700">Revenue tracking not live yet</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Once Rookie goes paid, this tab will show MRR, ARR, paying users,
              churn, LTV and conversion from free to paid.
              Currently all values are zero.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
            {["MRR", "ARR", "Paying users", "Churn rate", "LTV", "Free → Paid CVR"].map(t => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* KPI skeleton cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <ZeroStatCard icon={TrendingUp}  label="MRR"            sub="Monthly recurring"     accent="emerald" />
          <ZeroStatCard icon={TrendingUp}  label="ARR"            sub="Annual recurring"      accent="emerald" />
          <ZeroStatCard icon={Users}       label="Paying users"   sub="Active subscriptions"  accent="indigo"  />
          <ZeroStatCard icon={BarChart2}   label="Churn rate"     sub="Last 30 days"          accent="amber"   />
          <ZeroStatCard icon={CreditCard}  label="Avg LTV"        sub="Per paying student"    accent="violet"  />
          <ZeroStatCard icon={DollarSign}  label="Free → Paid"    sub="Conversion rate"       accent="slate"   />
        </div>

        {/* Revenue chart placeholder */}
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-slate-400" strokeWidth={1.8} />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">MRR — 12 months</h2>
          </div>
          {/* Flat line — no data */}
          <div className="flex items-end gap-0.5 h-14">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-sm" style={{ height: "2px" }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>12 months ago</span>
            <span>Now</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between text-xs text-slate-400 pb-4 pt-2 border-t border-slate-200">
          <span>Revenue module — not yet active</span>
          <a
            href="/api/export?type=revenue"
            download="rookie-revenue.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download CSV
          </a>
        </footer>

      </main>
    </div>
  );
}

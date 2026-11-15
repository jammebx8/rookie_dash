"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Crown,
  Search,
  RefreshCw,
  KeyRound,
  User,
  Sparkles,
  Eye,
  EyeOff,
  UserX,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface UserProfilePreview {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  source: string;
}

interface PassHolder {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string;
  planId: string;
  grantedAt: string;
  accessUntil: string;
  isActive: boolean;
  daysRemaining: number;
}

const CARD =
  "bg-white dark:bg-[#1b1e22] rounded-[16px] border border-[#ecebe8] dark:border-white/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

const DURATION_OPTIONS = [
  { days: 30, label: "1 Month", desc: "30 days" },
  { days: 90, label: "3 Months", desc: "90 days" },
  { days: 180, label: "6 Months", desc: "180 days" },
  { days: 365, label: "1 Year", desc: "365 days (Standard)", popular: true },
  { days: 730, label: "2 Years", desc: "730 days" },
  { days: 3650, label: "Lifetime", desc: "10 Years (~Lifetime)" },
];

export default function GrantPassPage() {
  // Form states
  const [email, setEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [durationDays, setDurationDays] = useState(365);
  const [note, setNote] = useState("");

  // User Lookup states
  const [checkingUser, setCheckingUser] = useState(false);
  const [lookedUpUser, setLookedUpUser] = useState<UserProfilePreview | null>(null);
  const [userHasActivePass, setUserHasActivePass] = useState<boolean | null>(null);
  const [userExistingDays, setUserExistingDays] = useState<number>(0);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pass Holders Table states
  const [passHolders, setPassHolders] = useState<PassHolder[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const [activeCount, setActiveCount] = useState(0);

  // Fetch list of pass holders
  const fetchPassHolders = useCallback(async () => {
    try {
      const res = await fetch("/api/grant-pass");
      if (!res.ok) throw new Error("Failed to load pass holders");
      const data = await res.json();
      setPassHolders(data.passHolders || []);
      setActiveCount(data.activeCount || 0);
    } catch (err: unknown) {
      console.error("fetchPassHolders error:", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch("/api/grant-pass");
        if (!res.ok) throw new Error("Failed to load pass holders");
        const data = await res.json();
        if (!ignore) {
          setPassHolders(data.passHolders || []);
          setActiveCount(data.activeCount || 0);
          setLoadingList(false);
        }
      } catch (err: unknown) {
        console.error("fetchPassHolders error:", err);
        if (!ignore) setLoadingList(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  // Check user on-demand or when email changes
  const handleCheckUser = async (targetEmail?: string) => {
    const emailToCheck = (targetEmail || email).trim();
    if (!emailToCheck || !emailToCheck.includes("@")) {
      setLookupError("Please enter a valid email to check.");
      setLookedUpUser(null);
      return;
    }

    setCheckingUser(true);
    setLookupError(null);
    setLookedUpUser(null);
    setUserHasActivePass(null);

    try {
      const res = await fetch(
        `/api/grant-pass?email=${encodeURIComponent(emailToCheck)}`
      );
      const data = await res.json();

      if (!res.ok || !data.found) {
        setLookupError(
          data.error ||
            `No account found registered with "${emailToCheck}". Make sure the user has signed up on Rookie.AI first.`
        );
        setLookedUpUser(null);
        setUserHasActivePass(null);
      } else {
        setLookedUpUser(data.user);
        setUserHasActivePass(data.hasActivePass);
        setUserExistingDays(data.daysRemaining || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check user details.";
      setLookupError(msg);
    } finally {
      setCheckingUser(false);
    }
  };

  // Submit Grant
  const handleGrantPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!email.trim() || !email.includes("@")) {
      setActionError("Please provide a valid user email.");
      return;
    }

    if (!adminPassword) {
      setActionError("Please enter the Lynx admin password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/grant-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          adminPassword: adminPassword.trim(),
          durationDays,
          note: note.trim(),
          action: "grant",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to grant pass.");
      }

      setActionSuccess(data.message);

      // Broadcast update across open tabs and app
      try {
        const bc = new BroadcastChannel("rookie_pass_sync");
        bc.postMessage({
          type: "ROOKIE_PASS_CHANGED",
          action: "grant",
          userId: data.user?.id,
          email: data.user?.email,
          timestamp: Date.now(),
        });
        bc.close();
      } catch {}
      try {
        localStorage.setItem("rookie_pass_sync_ts", String(Date.now()));
      } catch {}

      // Refresh table and user status
      setLoadingList(true);
      fetchPassHolders();
      handleCheckUser(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Revoke
  const handleRevokePass = async () => {
    if (!email.trim()) return;
    if (!adminPassword) {
      setActionError("Enter admin password to authorize revocation.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to revoke paid Rookie Pass access for ${email}? The user will immediately revert to a free account.`
      )
    ) {
      return;
    }

    setRevoking(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/grant-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          adminPassword: adminPassword.trim(),
          action: "revoke",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to revoke pass.");
      }

      setActionSuccess(data.message);

      // Broadcast update across open tabs and app
      try {
        const bc = new BroadcastChannel("rookie_pass_sync");
        bc.postMessage({
          type: "ROOKIE_PASS_CHANGED",
          action: "revoke",
          userId: data.user?.id,
          email: data.user?.email,
          timestamp: Date.now(),
        });
        bc.close();
      } catch {}
      try {
        localStorage.setItem("rookie_pass_sync_ts", String(Date.now()));
      } catch {}

      setLookedUpUser(null);
      setUserHasActivePass(false);
      setLoadingList(true);
      fetchPassHolders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke pass.";
      setActionError(msg);
    } finally {
      setRevoking(false);
    }
  };

  // Quick pre-fill from table
  const handleSelectUser = (holder: PassHolder) => {
    setEmail(holder.email);
    handleCheckUser(holder.email);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredHolders = passHolders.filter(
    (h) =>
      h.email.toLowerCase().includes(listSearch.toLowerCase()) ||
      h.name.toLowerCase().includes(listSearch.toLowerCase()) ||
      h.userId.toLowerCase().includes(listSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
              <Crown size={22} className="text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Grant Rookie Pass
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={12} />
                  Admin Override
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Grant full paid Rookie Pass access to any user by email without payment or transaction.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Active Passes
              </div>
              <div className="text-lg font-bold text-slate-900 leading-none">
                {activeCount}{" "}
                <span className="text-xs font-normal text-slate-400">
                  / {passHolders.length} total
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setLoadingList(true);
              fetchPassHolders();
            }}
            disabled={loadingList}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh active pass holders"
          >
            <RefreshCw size={16} className={loadingList ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Main Form Section ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: The Grant Pass Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`${CARD} p-6 sm:p-7 relative overflow-hidden`}>
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

            <form onSubmit={handleGrantPass} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-500" />
                  Grant Paid Access
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  The user will be immediately granted the Rookie Pass entitlement in Supabase and gain unrestricted access to all paid features.
                </p>
              </div>

              {/* Step 1: User Email */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  User Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setLookupError(null);
                      }}
                      onBlur={() => {
                        if (email.trim() && !lookedUpUser) {
                          handleCheckUser();
                        }
                      }}
                      placeholder="e.g. student@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckUser()}
                    disabled={checkingUser || !email.trim()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 text-xs font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-1.5 border border-slate-200"
                  >
                    {checkingUser ? (
                      <RefreshCw size={14} className="animate-spin text-emerald-600" />
                    ) : (
                      <Search size={14} />
                    )}
                    Check User
                  </button>
                </div>

                {/* User Lookup Preview Card */}
                {lookedUpUser && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {lookedUpUser.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lookedUpUser.avatarUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                          {lookedUpUser.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 leading-tight">
                          {lookedUpUser.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {lookedUpUser.email}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {userHasActivePass ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <Crown size={12} className="text-amber-500 fill-amber-500" />
                          Active Pass ({userExistingDays}d left)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">
                          Free Account
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Lookup Error Alert */}
                {lookupError && (
                  <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{lookupError}</span>
                  </div>
                )}
              </div>

              {/* Step 2: Admin Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Admin Password <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Special Lynx Admin authorization
                  </span>
                </div>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter Lynx admin password"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Step 3: Duration Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Pass Duration
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = durationDays === opt.days;
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setDurationDays(opt.days)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        {opt.popular && (
                          <span className="absolute -top-2 right-2 text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full shadow-xs">
                            DEFAULT
                          </span>
                        )}
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Optional Note */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Reason / Internal Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Scholarship recipient, top mock test ranker, friend, promo"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Feedback Banners */}
              {actionError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-sm text-rose-800">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <div className="font-semibold">Action Failed</div>
                    <div className="text-xs text-rose-700 mt-0.5">{actionError}</div>
                  </div>
                </div>
              )}

              {actionSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-sm text-emerald-800">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <div className="font-semibold">Success!</div>
                    <div className="text-xs text-emerald-700 mt-0.5">{actionSuccess}</div>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !email.trim() || !adminPassword}
                  className="w-full sm:flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Granting Rookie Pass...
                    </>
                  ) : (
                    <>
                      <Crown size={16} className="text-amber-300 fill-amber-300" />
                      {userHasActivePass ? "Extend Rookie Pass" : "Grant Rookie Pass"}
                    </>
                  )}
                </button>

                {/* Revoke button if user currently has pass */}
                {userHasActivePass && (
                  <button
                    type="button"
                    onClick={handleRevokePass}
                    disabled={revoking || submitting || !adminPassword}
                    className="w-full sm:w-auto py-3 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {revoking ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <UserX size={15} />
                    )}
                    Revoke Pass
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Platform Impact & Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: How it works & Platform Impact */}
          <div className={`${CARD} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <CheckCircle2 size={16} />
              </div>
              <h3>What gets unlocked for the user?</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              When granted, the user receives an active entitlement in Supabase for <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">rookie_pass_yearly</code>. Without any transaction:
            </p>

            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Full Test Series Access:</strong> Unlimited attempts at JEE Main & Advanced full mock tests, chapter tests, and custom tests.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Unlimited AI Explanations:</strong> Instant step-by-step AI question breakdowns and doubt resolutions.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Paid Crown Badge:</strong> Golden crown icon displayed beside their name on the public Leaderboard.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Immediate Effect:</strong> Next time the user loads or refreshes Rookie.AI, the pass status will be active.
                </span>
              </li>
            </ul>
          </div>

          {/* Card: Security Notice */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-900">
              <KeyRound size={15} className="text-amber-600" />
              <span>Admin Security Verification</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              This endpoint requires the Lynx admin password. Unauthorized attempts are rejected with 401/403. Pass grants are recorded directly in the database entitlements table.
            </p>
          </div>
        </div>
      </div>

      {/* ── Active Pass Holders Table ────────────────────────────────────────── */}
      <div className={`${CARD} p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Crown size={16} className="text-amber-500 fill-amber-500" />
              Rookie Pass Holders Directory ({passHolders.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All accounts with a registered pass entitlement. Click any user to inspect or extend.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900"
            />
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          {loadingList ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={20} className="animate-spin text-emerald-500" />
              <span className="text-xs">Loading pass holders...</span>
            </div>
          ) : filteredHolders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {listSearch ? "No matching pass holders found." : "No users with pass entitlements found."}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Granted Date</th>
                  <th className="py-3 px-3">Valid Until</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredHolders.map((holder) => (
                  <tr
                    key={holder.userId}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {holder.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={holder.avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">
                            {holder.name?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">
                            {holder.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {holder.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {holder.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <Crown size={11} className="text-amber-500 fill-amber-500" />
                          Active ({holder.daysRemaining}d left)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          <Clock size={11} />
                          Expired
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-500">
                      {holder.grantedAt
                        ? new Date(holder.grantedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {holder.accessUntil
                        ? new Date(holder.accessUntil).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleSelectUser(holder)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      >
                        Select & Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

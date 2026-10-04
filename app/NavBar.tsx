"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  DollarSign,
} from "lucide-react";

const TABS = [
  { href: "/",        label: "Dashboard", icon: LayoutDashboard },
  { href: "/features", label: "Features",  icon: Zap            },
  { href: "/revenue",  label: "Revenue",   icon: DollarSign     },
] as const;

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 gap-6">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#10b981" />
              <path d="M8 20V10l6-3 6 3v10"   stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 20v-5h6v5"          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-slate-900 text-base tracking-tight leading-none">
              Rookie
            </span>
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full leading-none">
              Admin
            </span>
          </div>

          {/* Tab navigation */}
          <nav className="flex items-end h-full gap-0.5" aria-label="Main navigation">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex items-center gap-2 px-4 h-14 text-sm font-medium transition-colors select-none",
                    active
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                >
                  <Icon
                    size={15}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-emerald-600" : ""}
                  />
                  {label}
                  {/* Active underline */}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500 rounded-t-sm" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right slot — date */}
          <div className="ml-auto hidden sm:block text-xs text-slate-400 shrink-0">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day:     "numeric",
              month:   "short",
              year:    "numeric",
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

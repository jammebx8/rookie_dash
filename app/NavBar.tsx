"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Zap,
  DollarSign,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useNightOwl } from "@/lib/theme";

const TABS = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/features",  label: "Features",   icon: Zap            },
  { href: "/revenue",   label: "Revenue",    icon: DollarSign     },
  { href: "/grant-pass",label: "Grant Pass", icon: ShieldCheck    },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const { dark, toggle, mounted } = useNightOwl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#16181c]/95 backdrop-blur-md border-b border-[#ecebe8] dark:border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Brand Left Slot */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-dp-sky-500"
            >
              <div className="relative size-8 rounded-[8px] overflow-hidden bg-[#e3f1ff] dark:bg-sky-950/80 flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/10">
                <Image
                  src="/brand/rookie-owl.png"
                  alt="Rookie"
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  priority
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[15px] tracking-tight text-[#0f172a] dark:text-[#ffffff]">
                  Rookie
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#e3f1ff] text-[#1d4f86] dark:bg-sky-950/80 dark:text-sky-300">
                  Admin
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center ml-4 gap-1" aria-label="Main navigation">
              {TABS.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors select-none",
                      active
                        ? "bg-[#e3f1ff] text-[#1d4f86] dark:bg-sky-950/80 dark:text-sky-200 font-semibold"
                        : "text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f1ef] dark:text-[#cbd5e1] dark:hover:text-[#ffffff] dark:hover:bg-white/5",
                    ].join(" ")}
                  >
                    <Icon
                      size={15}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={active ? "text-[#1d4f86] dark:text-sky-400" : ""}
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Slot */}
          <div className="flex items-center gap-2">
            {/* Live date indicator (Desktop) */}
            <div className="hidden lg:block text-[12px] font-medium text-[#475569] dark:text-[#cbd5e1] mr-2">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>

            {/* Night Owl Theme Toggle */}
            <button
              type="button"
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to Night owl dark mode"}
              title={dark ? "Switch to light mode" : "Switch to Night owl"}
              className="size-9 rounded-[8px] flex items-center justify-center text-[#475569] dark:text-[#cbd5e1] hover:bg-[#f1f1ef] dark:hover:bg-white/10 transition-colors border border-transparent hover:border-[#ecebe8] dark:hover:border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-dp-sky-500"
            >
              {mounted && dark ? (
                <Sun size={17} className="text-[#ffd84d]" />
              ) : (
                <Moon size={17} className="text-[#475569]" />
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden size-9 rounded-[8px] flex items-center justify-center text-[#475569] dark:text-[#cbd5e1] hover:bg-[#f1f1ef] dark:hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-[#ecebe8] dark:border-white/10 flex flex-col gap-1">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[14px] font-medium transition-colors",
                    active
                      ? "bg-[#e3f1ff] text-[#1d4f86] dark:bg-sky-950/80 dark:text-sky-200 font-semibold"
                      : "text-[#475569] hover:bg-[#f1f1ef] dark:text-[#cbd5e1] dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  <Icon
                    size={17}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-[#1d4f86] dark:text-sky-400" : ""}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}

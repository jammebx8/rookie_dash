"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Dropper Night Owl hook for light/dark mode.
 * Persists user preference in localStorage under 'theme'.
 * Toggles class `dark` on document.documentElement.
 */
export function useNightOwl() {
  const [dark, setDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    let initial = false;
    try {
      const stored = localStorage.getItem("theme");
      if (stored) {
        initial = stored === "dark";
      } else {
        initial = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    } catch {}

    const root = document.documentElement;
    root.classList.toggle("dark", initial);
    setDark(initial);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      const root = document.documentElement;
      root.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  }, []);

  return { dark, toggle, mounted };
}

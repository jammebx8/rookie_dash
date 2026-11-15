import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "./NavBar";

export const metadata: Metadata = {
  title: "Rookie — Admin Analytics & Operations",
  description: "Real-time analytics, user retention, cohort analysis and revenue operations for Rookie",
  icons: {
    icon: "/brand/rookie-owl.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme');
                const isDark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#f8f8f7] dark:bg-[#0f1115] text-[#0f172a] dark:text-[#f8fafc] antialiased">
        <NavBar />
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}

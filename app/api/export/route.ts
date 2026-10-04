/**
 * /api/export
 *
 * Downloads a structured CSV of the analytics_events table so the data can
 * be fed directly to an AI or shared with collaborators.
 *
 * Query params:
 *   ?type=events   (default) — full analytics_events dump
 *   ?type=summary  — per-student per-feature daily summary
 *   ?type=cohorts  — cohort retention matrix (same as /api/retention)
 *   ?type=revenue  — zero row revenue stub
 *   ?days=N        — look-back window in days (default 90, max 365)
 *
 * The response sets Content-Disposition: attachment so the browser
 * triggers a download automatically.
 */
import { createServerSupabaseClient } from "@/lib/supabase";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/** Escape a single CSV cell value */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // If contains comma, newline or double-quote, wrap in double-quotes
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(cell).join(",");
}

function csvDocument(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map(csvRow)].join("\n");
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sb   = createServerSupabaseClient();
  const url  = new URL(req.url);
  const type = url.searchParams.get("type") ?? "events";
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") ?? "90", 10)));

  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const isoSince = since.toISOString();

  try {

    // ── events ────────────────────────────────────────────────────────────────
    if (type === "events") {
      const { data, error } = await sb
        .from("analytics_events")
        .select("id, student_id, session_id, event_name, ts, question_id, test_id, feature, subject, chapter, difficulty, duration_ms, metadata")
        .gte("ts", isoSince)
        .order("ts", { ascending: false })
        .limit(500_000);

      if (error) throw new Error(error.message);

      const headers = [
        "id", "student_id", "session_id", "event_name", "ts",
        "question_id", "test_id", "feature", "subject", "chapter",
        "difficulty", "duration_ms", "metadata",
      ];

      const rows = (data ?? []).map((e: Record<string, unknown>) => [
        e.id, e.student_id, e.session_id, e.event_name, e.ts,
        e.question_id, e.test_id, e.feature, e.subject, e.chapter,
        e.difficulty, e.duration_ms,
        e.metadata ? JSON.stringify(e.metadata) : "",
      ]);

      const csv = csvDocument(headers, rows);

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rookie-events-${days}d-${datestamp()}.csv"`,
        },
      });
    }

    // ── summary ───────────────────────────────────────────────────────────────
    if (type === "summary") {
      // Per-student per-feature per-day aggregation
      const { data, error } = await sb
        .from("analytics_events")
        .select("student_id, session_id, feature, event_name, ts, question_id, duration_ms, subject, chapter")
        .gte("ts", isoSince)
        .limit(500_000);

      if (error) throw new Error(error.message);

      type SumKey  = string;
      type SumBucket = {
        student_id: string; feature: string; day: string;
        events: number; questions_answered: number; questions_correct: number;
        solution_reads: number; total_read_ms: number; sessions: Set<string>;
      };

      const buckets = new Map<SumKey, SumBucket>();

      for (const e of (data ?? []) as Record<string, unknown>[]) {
        const sid  = (e.student_id as string | null) ?? "anon";
        const feat = (e.feature    as string | null) ?? "unknown";
        const day  = (e.ts         as string).slice(0, 10);
        const key  = `${sid}::${feat}::${day}`;

        if (!buckets.has(key)) {
          buckets.set(key, {
            student_id: sid, feature: feat, day,
            events: 0, questions_answered: 0, questions_correct: 0,
            solution_reads: 0, total_read_ms: 0, sessions: new Set(),
          });
        }
        const b  = buckets.get(key)!;
        const ev = e.event_name as string;
        b.events++;
        if (e.session_id) b.sessions.add(e.session_id as string);
        if (ev === "question_answered") b.questions_answered++;
        if (ev === "question_correct")  b.questions_correct++;
        if (ev === "solution_read")     { b.solution_reads++; b.total_read_ms += (e.duration_ms as number) ?? 0; }
      }

      const headers = [
        "date", "student_id", "feature", "total_events", "sessions",
        "questions_answered", "questions_correct", "accuracy_pct",
        "solution_reads", "avg_read_ms",
      ];

      const rows: unknown[][] = [];
      buckets.forEach(b => {
        const acc = b.questions_answered > 0
          ? Math.round((b.questions_correct / b.questions_answered) * 100)
          : "";
        const avgMs = b.solution_reads > 0 ? Math.round(b.total_read_ms / b.solution_reads) : 0;
        rows.push([
          b.day, b.student_id, b.feature, b.events, b.sessions.size,
          b.questions_answered, b.questions_correct, acc,
          b.solution_reads, avgMs,
        ]);
      });
      rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));

      return new Response(csvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rookie-summary-${days}d-${datestamp()}.csv"`,
        },
      });
    }

    // ── cohorts ───────────────────────────────────────────────────────────────
    if (type === "cohorts") {
      // Pull 60 days of activity for D7 cohort windows
      const sixtyAgo = new Date(Date.now() - 59 * 86_400_000);
      sixtyAgo.setHours(0, 0, 0, 0);

      const { data, error } = await sb
        .from("user_activity")
        .select("user_id, answered_at")
        .gte("answered_at", sixtyAgo.toISOString())
        .not("user_id", "is", null)
        .limit(200_000);

      if (error) throw new Error(error.message);

      // Build userDays
      const userDays = new Map<string, Set<string>>();
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const uid = r.user_id as string;
        const day = (r.answered_at as string).slice(0, 10);
        if (!userDays.has(uid)) userDays.set(uid, new Set());
        userDays.get(uid)!.add(day);
      }

      // First seen
      const firstSeen = new Map<string, string>();
      userDays.forEach((days, uid) => { firstSeen.set(uid, [...days].sort()[0]); });

      // Cohorts
      const cohortMap = new Map<string, Set<string>>();
      firstSeen.forEach((day, uid) => {
        if (!cohortMap.has(day)) cohortMap.set(day, new Set());
        cohortMap.get(day)!.add(uid);
      });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const headers = ["cohort_date", "cohort_size", "d1", "d2", "d3", "d4", "d5", "d6", "d7"];
      const rows: unknown[][] = [];

      for (let c = 29; c >= 0; c--) {
        const cohortDate = new Date(Date.now() - c * 86_400_000);
        cohortDate.setHours(0, 0, 0, 0);
        const key    = cohortDate.toISOString().slice(0, 10);
        const cohort = cohortMap.get(key);
        if (!cohort || cohort.size === 0) continue;

        const dn: (number | string)[] = [];
        for (let n = 1; n <= 7; n++) {
          const target = new Date(cohortDate.getTime() + n * 86_400_000);
          target.setHours(0, 0, 0, 0);
          if (target > today) { dn.push(""); continue; }
          const targetKey = target.toISOString().slice(0, 10);
          const returned  = [...cohort].filter(uid => userDays.get(uid)?.has(targetKey)).length;
          dn.push(Math.round((returned / cohort.size) * 100));
        }
        rows.push([key, cohort.size, ...dn]);
      }

      return new Response(csvDocument(headers, rows), {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rookie-cohorts-${datestamp()}.csv"`,
        },
      });
    }

    // ── revenue (stub) ────────────────────────────────────────────────────────
    if (type === "revenue") {
      const headers = ["date", "mrr", "arr", "paying_users", "churn_rate_pct", "avg_ltv", "free_to_paid_pct"];
      const csv     = csvDocument(headers, [[new Date().toISOString().slice(0, 10), 0, 0, 0, 0, 0, 0]]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type":        "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rookie-revenue-${datestamp()}.csv"`,
        },
      });
    }

    return new Response("Unknown type", { status: 400 });

  } catch (err) {
    console.error("[export]", err);
    return new Response(`error,${String(err)}\n`, {
      status: 500,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
}

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}

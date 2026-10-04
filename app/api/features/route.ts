/**
 * /api/features
 *
 * Queries public.analytics_events to answer every question shown on the
 * Features tab:
 *
 *   feature_counts    — unique students + event count per (feature, event)
 *   solution_read     — avg / p50 / p90 duration_ms on 'solution_read' events
 *   test_funnel       — created → started → completed vs abandoned
 *   activation_funnel — "have they hit the activation threshold in session 1?"
 *     We define activation candidates as students whose EARLIEST session_id
 *     saw ≥ 3 answered events AND ≥ 1 correct event.
 *   daily_events      — 30-day sparkline of total events per day
 *   top_chapters      — chapters most opened in question_viewer / practice
 */
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface FeatureCount {
  feature:         string;
  event_name:      string;
  event_count:     number;
  unique_students: number;
}

interface SolutionStat {
  feature:       string;
  count:         number;
  avg_ms:        number;
  p50_ms:        number;
  p90_ms:        number;
  pct_over_10s:  number;   // % who spent > 10 s reading
}

interface TestFunnel {
  created:       number;
  started:       number;
  completed:     number;
  abandoned:     number;
  start_rate:    number;   // started / created %
  complete_rate: number;   // completed / started %
  abandon_rate:  number;   // abandoned / started %
}

interface ActivationData {
  total_students:   number;
  activated:        number;   // hit threshold in first session
  activation_rate:  number;
  threshold:        string;
}

export interface FeaturesData {
  feature_counts:    FeatureCount[];
  solution_stats:    SolutionStat[];
  test_funnel:       TestFunnel;
  activation:        ActivationData;
  daily_events:      { date: string; label: string; count: number }[];
  top_chapters:      { chapter: string; subject: string; opens: number }[];
  error?:            string;
}

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const iso30 = thirtyDaysAgo.toISOString();

    // ── Fetch everything in parallel ─────────────────────────────────────────
    const [eventsRes, solutionRes, testRes, chapterRes] = await Promise.all([

      // All events in the last 30 days (for counts + funnel + activation)
      sb
        .from("analytics_events")
        .select("student_id, session_id, event_name, feature, subject, chapter, duration_ms, ts, question_id")
        .gte("ts", iso30)
        .limit(200_000),

      // Solution read events with duration
      sb
        .from("analytics_events")
        .select("feature, duration_ms")
        .eq("event_name", "solution_read")
        .not("duration_ms", "is", null)
        .limit(50_000),

      // Test lifecycle events
      sb
        .from("analytics_events")
        .select("event_name, student_id, test_id")
        .in("event_name", ["test_created", "test_started", "test_completed", "test_abandoned"])
        .limit(50_000),

      // Question opened/answered events for chapter breakdown
      sb
        .from("analytics_events")
        .select("chapter, subject, event_name")
        .in("event_name", ["question_opened", "question_answered"])
        .not("chapter", "is", null)
        .gte("ts", iso30)
        .limit(100_000),
    ]);

    const allEvents   = (eventsRes.data    ?? []) as Record<string, unknown>[];
    const solEvents   = (solutionRes.data  ?? []) as Record<string, unknown>[];
    const testEvents  = (testRes.data      ?? []) as Record<string, unknown>[];
    const chapEvents  = (chapterRes.data   ?? []) as Record<string, unknown>[];

    // ── 1. Feature × event counts ─────────────────────────────────────────────
    type CountKey = string; // `${feature}::${event_name}`
    const countMap = new Map<CountKey, { events: number; students: Set<string> }>();

    for (const e of allEvents) {
      const feat  = (e.feature    as string | null) ?? "unknown";
      const evt   = (e.event_name as string)        ?? "unknown";
      const sid   = (e.student_id as string | null) ?? "";
      const key   = `${feat}::${evt}`;
      if (!countMap.has(key)) countMap.set(key, { events: 0, students: new Set() });
      const bucket = countMap.get(key)!;
      bucket.events++;
      if (sid) bucket.students.add(sid);
    }

    const feature_counts: FeatureCount[] = [];
    countMap.forEach((v, k) => {
      const [feature, event_name] = k.split("::");
      feature_counts.push({
        feature,
        event_name,
        event_count:     v.events,
        unique_students: v.students.size,
      });
    });
    feature_counts.sort((a, b) => b.event_count - a.event_count);

    // ── 2. Solution read stats ─────────────────────────────────────────────────
    // Group by feature
    type SolBucket = { feat: string; durations: number[] };
    const solMap = new Map<string, SolBucket>();
    for (const e of solEvents) {
      const feat = (e.feature as string | null) ?? "unknown";
      const ms   = e.duration_ms as number;
      if (!solMap.has(feat)) solMap.set(feat, { feat, durations: [] });
      solMap.get(feat)!.durations.push(ms);
    }

    const solution_stats: SolutionStat[] = [];
    solMap.forEach(({ feat, durations }) => {
      if (durations.length === 0) return;
      durations.sort((a, b) => a - b);
      const avg    = Math.round(durations.reduce((s, n) => s + n, 0) / durations.length);
      const p50    = durations[Math.floor(durations.length * 0.5)] ?? 0;
      const p90    = durations[Math.floor(durations.length * 0.9)] ?? 0;
      const over10 = durations.filter(d => d >= 10_000).length;
      solution_stats.push({
        feature:      feat,
        count:        durations.length,
        avg_ms:       avg,
        p50_ms:       p50,
        p90_ms:       p90,
        pct_over_10s: Math.round((over10 / durations.length) * 100),
      });
    });

    // ── 3. Test funnel ────────────────────────────────────────────────────────
    const testByName: Record<string, Set<string>> = {
      test_created:   new Set(),
      test_started:   new Set(),
      test_completed: new Set(),
      test_abandoned: new Set(),
    };
    for (const e of testEvents) {
      const name = e.event_name as string;
      const id   = (e.test_id as string | null) ?? (e.student_id as string | null) ?? "";
      if (testByName[name]) testByName[name].add(id);
    }
    const created   = testByName.test_created.size;
    const started   = testByName.test_started.size;
    const completed = testByName.test_completed.size;
    const abandoned = testByName.test_abandoned.size;

    const test_funnel: TestFunnel = {
      created,
      started,
      completed,
      abandoned,
      start_rate:    created   > 0 ? Math.round((started   / created)   * 100) : 0,
      complete_rate: started   > 0 ? Math.round((completed / started)   * 100) : 0,
      abandon_rate:  started   > 0 ? Math.round((abandoned / started)   * 100) : 0,
    };

    // ── 4. Activation analysis ────────────────────────────────────────────────
    // Activation = student's FIRST session_id had ≥ 3 answered + ≥ 1 correct
    // We look at answered events grouped by (student_id, session_id)
    type SessionKey = string;
    const sessionMap = new Map<SessionKey, { answered: number; correct: number; student: string }>();

    for (const e of allEvents) {
      const sid  = (e.student_id as string | null);
      const sess = (e.session_id as string | null);
      const evt  = (e.event_name as string | null);
      if (!sid || !sess) continue;
      const key = `${sid}::${sess}`;

      if (evt === "question_answered") {
        if (!sessionMap.has(key)) sessionMap.set(key, { answered: 0, correct: 0, student: sid });
        sessionMap.get(key)!.answered++;
      }
      if (evt === "question_correct") {
        if (!sessionMap.has(key)) sessionMap.set(key, { answered: 0, correct: 0, student: sid });
        sessionMap.get(key)!.correct++;
      }
    }

    // Find each student's first session
    const studentFirstSession = new Map<string, string>();
    for (const e of allEvents) {
      const sid  = (e.student_id as string | null);
      const sess = (e.session_id as string | null);
      if (!sid || !sess) continue;
      if (!studentFirstSession.has(sid)) studentFirstSession.set(sid, sess);
    }

    let activated = 0;
    const total_students = studentFirstSession.size;

    studentFirstSession.forEach((firstSess, student) => {
      const key  = `${student}::${firstSess}`;
      const data = sessionMap.get(key);
      if (data && data.answered >= 3 && data.correct >= 1) activated++;
    });

    const activation: ActivationData = {
      total_students,
      activated,
      activation_rate: total_students > 0 ? Math.round((activated / total_students) * 100) : 0,
      threshold:       "≥ 3 questions answered + ≥ 1 correct in first session",
    };

    // ── 5. Daily events sparkline (30 days) ───────────────────────────────────
    const dayBuckets: Record<string, number> = {};
    for (const e of allEvents) {
      const day = (e.ts as string).slice(0, 10);
      dayBuckets[day] = (dayBuckets[day] ?? 0) + 1;
    }
    const daily_events = Array.from({ length: 30 }, (_, i) => {
      const d   = new Date(Date.now() - (29 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      return {
        date:  key,
        label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        count: dayBuckets[key] ?? 0,
      };
    });

    // ── 6. Top chapters ───────────────────────────────────────────────────────
    const chapMap = new Map<string, { chapter: string; subject: string; opens: number }>();
    for (const e of chapEvents) {
      const ch  = e.chapter as string;
      const sub = (e.subject as string | null) ?? "";
      const key = `${sub}::${ch}`;
      if (!chapMap.has(key)) chapMap.set(key, { chapter: ch, subject: sub, opens: 0 });
      chapMap.get(key)!.opens++;
    }
    const top_chapters = [...chapMap.values()]
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 20);

    return Response.json({
      feature_counts,
      solution_stats,
      test_funnel,
      activation,
      daily_events,
      top_chapters,
    } satisfies FeaturesData);

  } catch (err) {
    console.error("[features]", err);
    return Response.json(
      {
        feature_counts: [], solution_stats: [], daily_events: [], top_chapters: [],
        test_funnel:    { created: 0, started: 0, completed: 0, abandoned: 0, start_rate: 0, complete_rate: 0, abandon_rate: 0 },
        activation:     { total_students: 0, activated: 0, activation_rate: 0, threshold: "" },
        error: String(err),
      } satisfies FeaturesData,
      { status: 200 },
    );
  }
}

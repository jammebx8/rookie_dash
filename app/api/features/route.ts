/**
 * /api/features
 *
 * Supports:
 *   ?segment=all | free | paid (default: all)
 *
 * Queries public.analytics_events to answer:
 *   feature_counts        — unique students + event count per (feature, event)
 *   repeat_feature_usage  — which features are used repeatedly (2+ days)
 *   solution_read         — avg / p50 / p90 duration_ms on 'solution_read' events
 *   test_funnel           — created → started → completed vs abandoned
 *   activation_funnel     — hit threshold in session 1
 *   daily_events          — 30-day sparkline of total events per day
 *   top_chapters          — chapters most opened in question_viewer / practice
 */
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface FeatureCount {
  feature:         string;
  event_name:      string;
  event_count:     number;
  unique_students: number;
}

interface RepeatFeatureUsage {
  feature:          string;
  totalStudents:    number;
  repeatStudents:   number;   // used on 2+ days
  repeatRate:       number;   // %
  totalEvents:      number;
  avgEventsPerUser: number;
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

export interface ImpactMetrics {
  dailyPractice: {
    started_users: number;
    completed_users: number;
    completion_rate: number;
    total_answers: number;
  };
  questionViewer: {
    unique_users: number;
    total_answers: number;
    solutions_viewed: number;
    similar_attempted: number;
  };
  retentionImpact: {
    repeat_daily_practice_users: number;
    daily_practice_repeat_rate: number;
  };
  equationHints: {
    total_uses: number;
    unique_users: number;
    repeat_users: number;
    repeat_rate: number;
    by_feature: { feature: string; count: number }[];
  };
}

export interface FeaturesData {
  segment:               string;
  feature_counts:        FeatureCount[];
  repeat_feature_usage:  RepeatFeatureUsage[];
  solution_stats:        SolutionStat[];
  test_funnel:           TestFunnel;
  activation:            ActivationData;
  impact_metrics?:       ImpactMetrics;
  daily_events:          { date: string; label: string; count: number }[];
  top_chapters:          { chapter: string; subject: string; opens: number }[];
  error?:                string;
}

async function fetchAllAnalyticsEvents(
  sb: ReturnType<typeof createServerSupabaseClient>,
  iso30: string
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;

  // 1. Fetch first batch and exact total count
  const firstRes = await sb
    .from("analytics_events")
    .select(
      "student_id, session_id, event_name, feature, subject, chapter, duration_ms, ts, question_id",
      { count: "exact" }
    )
    .gte("ts", iso30)
    .order("ts", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (firstRes.error) {
    console.error("[features] Error fetching analytics_events first page:", firstRes.error);
    return [];
  }

  const allEvents = [...(firstRes.data ?? [])] as Record<string, unknown>[];
  const total = firstRes.count ?? allEvents.length;

  // 2. Fetch remaining pages in parallel if total exceeds PAGE_SIZE
  if (total > PAGE_SIZE) {
    const promises = [];
    const MAX_EVENTS = 50_000;
    for (let from = PAGE_SIZE; from < total && from < MAX_EVENTS; from += PAGE_SIZE) {
      promises.push(
        sb
          .from("analytics_events")
          .select("student_id, session_id, event_name, feature, subject, chapter, duration_ms, ts, question_id")
          .gte("ts", iso30)
          .order("ts", { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
      );
    }

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.data) {
        allEvents.push(...(r.data as Record<string, unknown>[]));
      }
    }
  }

  return allEvents;
}

export async function GET(req: NextRequest) {
  try {
    const sb = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const segment = (searchParams.get("segment") ?? "all").toLowerCase(); // all | free | paid

    const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const iso30 = thirtyDaysAgo.toISOString();

    // ── Fetch paid users for segmentation + all events in parallel ──────────
    const [rawAllEvents, solutionRes, testRes, entRes, ordersRes] = await Promise.all([
      fetchAllAnalyticsEvents(sb, iso30),

      sb
        .from("analytics_events")
        .select("student_id, feature, duration_ms")
        .eq("event_name", "solution_read")
        .not("duration_ms", "is", null)
        .order("ts", { ascending: false })
        .limit(10_000),

      sb
        .from("analytics_events")
        .select("student_id, event_name, test_id")
        .in("event_name", ["test_created", "test_started", "test_completed", "test_abandoned"])
        .order("ts", { ascending: false })
        .limit(10_000),

      sb.from("entitlements").select("user_id, access_until"),
      sb.from("orders").select("user_id, status"),
    ]);

    const nowIso = new Date().toISOString();
    const paidUserIds = new Set<string>();
    (entRes.data ?? []).forEach((e) => {
      if ((e.access_until as string) > nowIso) paidUserIds.add(e.user_id as string);
    });
    (ordersRes.data ?? []).forEach((o) => {
      if (o.status === "paid") paidUserIds.add(o.user_id as string);
    });

    // ── Filter events by Free vs Paid segment ────────────────────────────────
    const filterBySegment = (e: Record<string, unknown>) => {
      const sid = (e.student_id as string | null) ?? "";
      if (segment === "paid") return paidUserIds.has(sid);
      if (segment === "free") return !paidUserIds.has(sid);
      return true;
    };

    const allEvents  = rawAllEvents.filter(filterBySegment);
    const solEvents  = ((solutionRes.data ?? []) as Record<string, unknown>[]).filter(filterBySegment);
    const testEvents = ((testRes.data ?? []) as Record<string, unknown>[]).filter(filterBySegment);

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

    // ── 2. Repeat Feature Usage Analysis ──────────────────────────────────────
    // For each feature, compute how many users used it on 2+ distinct calendar days
    const featUserDays = new Map<string, Map<string, Set<string>>>(); // feature -> student_id -> Set of days
    const featEventCounts = new Map<string, number>();

    for (const e of allEvents) {
      const feat = (e.feature as string | null);
      const sid  = (e.student_id as string | null);
      const ts   = (e.ts as string | null);
      if (!feat || !sid || !ts) continue;

      const day = ts.slice(0, 10);
      if (!featUserDays.has(feat)) featUserDays.set(feat, new Map());
      const userMap = featUserDays.get(feat)!;
      if (!userMap.has(sid)) userMap.set(sid, new Set());
      userMap.get(sid)!.add(day);

      featEventCounts.set(feat, (featEventCounts.get(feat) ?? 0) + 1);
    }

    const repeat_feature_usage: RepeatFeatureUsage[] = [];
    featUserDays.forEach((users, feat) => {
      const totalStudents = users.size;
      const repeatStudents = [...users.values()].filter((days) => days.size > 1).length;
      const totalEvents = featEventCounts.get(feat) ?? 0;
      repeat_feature_usage.push({
        feature: feat,
        totalStudents,
        repeatStudents,
        repeatRate: totalStudents > 0 ? Math.round((repeatStudents / totalStudents) * 100) : 0,
        totalEvents,
        avgEventsPerUser: totalStudents > 0 ? Number((totalEvents / totalStudents).toFixed(1)) : 0,
      });
    });
    repeat_feature_usage.sort((a, b) => b.totalStudents - a.totalStudents);

    // ── 3. Solution read stats ─────────────────────────────────────────────────
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

    // ── 4. Test funnel ────────────────────────────────────────────────────────
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

    // ── 5. Activation analysis ────────────────────────────────────────────────
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

    // ── 6. Daily events sparkline (30 days) ───────────────────────────────────
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

    // ── 7. Top chapters ───────────────────────────────────────────────────────
    const chapMap = new Map<string, { chapter: string; subject: string; opens: number }>();
    for (const e of allEvents) {
      const evt = e.event_name as string;
      if (evt !== "question_opened" && evt !== "question_answered") continue;
      if (!e.chapter) continue;
      const ch  = e.chapter as string;
      const sub = (e.subject as string | null) ?? "";
      const key = `${sub}::${ch}`;
      if (!chapMap.has(key)) chapMap.set(key, { chapter: ch, subject: sub, opens: 0 });
      chapMap.get(key)!.opens++;
    }
    const top_chapters = [...chapMap.values()]
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 20);

    // ── 8. Impact metrics (Daily Practice & Unrestricted Question Viewer) ──
    const dpStartedStudents = new Set<string>();
    const dpCompletedStudents = new Set<string>();
    let dpTotalAnswers = 0;

    const qvStudents = new Set<string>();
    let qvTotalAnswers = 0;
    let qvSolutionsViewed = 0;
    let similarAttemptedCount = 0;

    for (const e of allEvents) {
      const evt = (e.event_name as string) ?? "";
      const feat = (e.feature as string) ?? "";
      const sid = (e.student_id as string) ?? "";

      if (feat === "daily_practice") {
        if (evt === "daily_practice_started" && sid) dpStartedStudents.add(sid);
        if (evt === "daily_practice_completed" && sid) dpCompletedStudents.add(sid);
        if (evt === "question_answered") dpTotalAnswers++;
      }

      if (feat === "question_viewer") {
        if (sid) qvStudents.add(sid);
        if (evt === "question_answered") qvTotalAnswers++;
        if (evt === "solution_viewed") qvSolutionsViewed++;
      }

      if (feat === "similar" && (evt === "similar_attempted" || evt === "question_answered")) {
        similarAttemptedCount++;
      }
    }

    const dpRepeat = repeat_feature_usage.find(r => r.feature === "daily_practice");

    // ── Equation hint usage ────────────────────────────────────────────────────
    const hintUserDays = new Map<string, Set<string>>();   // uid → Set<day>
    const hintByFeature = new Map<string, number>();       // feature → count
    let hintTotalUses = 0;

    for (const e of allEvents) {
      if ((e.event_name as string) !== "equation_hint_used") continue;
      const sid  = (e.student_id as string) ?? "";
      const feat = (e.feature as string) ?? "unknown";
      const ts   = (e.ts as string) ?? "";
      if (sid) {
        if (!hintUserDays.has(sid)) hintUserDays.set(sid, new Set());
        hintUserDays.get(sid)!.add(ts.slice(0, 10));
      }
      hintByFeature.set(feat, (hintByFeature.get(feat) ?? 0) + 1);
      hintTotalUses++;
    }

    const hintUniqueUsers  = hintUserDays.size;
    const hintRepeatUsers  = [...hintUserDays.values()].filter(days => days.size > 1).length;
    const hintRepeatRate   = hintUniqueUsers > 0
      ? Math.round((hintRepeatUsers / hintUniqueUsers) * 100)
      : 0;
    const hintByFeatureArr = [...hintByFeature.entries()]
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count);

    const impact_metrics: ImpactMetrics = {
      dailyPractice: {
        started_users: dpStartedStudents.size,
        completed_users: dpCompletedStudents.size,
        completion_rate: dpStartedStudents.size > 0 ? Math.round((dpCompletedStudents.size / dpStartedStudents.size) * 100) : 0,
        total_answers: dpTotalAnswers,
      },
      questionViewer: {
        unique_users: qvStudents.size,
        total_answers: qvTotalAnswers,
        solutions_viewed: qvSolutionsViewed,
        similar_attempted: similarAttemptedCount,
      },
      retentionImpact: {
        repeat_daily_practice_users: dpRepeat?.repeatStudents ?? 0,
        daily_practice_repeat_rate: dpRepeat?.repeatRate ?? 0,
      },
      equationHints: {
        total_uses:   hintTotalUses,
        unique_users: hintUniqueUsers,
        repeat_users: hintRepeatUsers,
        repeat_rate:  hintRepeatRate,
        by_feature:   hintByFeatureArr,
      },
    };

    return Response.json({
      segment,
      feature_counts,
      repeat_feature_usage,
      solution_stats,
      test_funnel,
      activation,
      impact_metrics,
      daily_events,
      top_chapters,
    } satisfies FeaturesData);

  } catch (err) {
    console.error("[features]", err);
    return Response.json(
      {
        segment: "all",
        feature_counts: [], repeat_feature_usage: [], solution_stats: [], daily_events: [], top_chapters: [],
        test_funnel:    { created: 0, started: 0, completed: 0, abandoned: 0, start_rate: 0, complete_rate: 0, abandon_rate: 0 },
        activation:     { total_students: 0, activated: 0, activation_rate: 0, threshold: "" },
        error: String(err),
      } satisfies FeaturesData,
      { status: 200 },
    );
  }
}

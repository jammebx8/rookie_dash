import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing user ID" }, { status: 400 });

    const sb = createServerSupabaseClient();

    const [
      authRes,
      publicUserRes,
      attemptsRes,
      activityRes,
      testsRes,
      ordersRes,
      entitlementsRes,
      streakRes,
      recentSessionRes,
    ] = await Promise.all([
      sb.auth.admin.getUserById(id),
      sb.from("users").select("*").eq("id", id).single(),
      sb.from("attempts").select("*").eq("student_id", id).order("created_at", { ascending: false }).limit(200),
      sb.from("user_activity").select("*").eq("user_id", id).order("answered_at", { ascending: false }).limit(500),
      sb.from("test_attempts").select("id, title, status, created_at, score, total_marks").eq("user_id", id).order("created_at", { ascending: false }),
      sb.from("orders").select("id, plan_id, amount, status, created_at, paid_at").eq("user_id", id).order("created_at", { ascending: false }),
      sb.from("entitlements").select("plan_id, access_until, granted_at").eq("user_id", id),
      sb.from("user_streaks").select("current_streak, longest_streak").eq("user_id", id).single(),
      sb.from("user_recent_session").select("chapter_title, subject_name, updated_at").eq("user_id", id).single(),
    ]);

    const authUser = authRes.data?.user;
    const publicUser = publicUserRes.data;
    const attempts = attemptsRes.data ?? [];
    const activity = activityRes.data ?? [];
    const tests = testsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const entitlements = entitlementsRes.data ?? [];
    const streak = streakRes.data;
    const recentSession = recentSessionRes.data;

    // Resolve name, email, avatar
    const meta = (authUser?.user_metadata ?? {}) as Record<string, string>;
    const name = publicUser?.name
      ?? meta.full_name
      ?? meta.name
      ?? meta.display_name
      ?? authUser?.email?.split("@")[0]
      ?? id.slice(0, 8);
    const email = publicUser?.email ?? authUser?.email ?? "";
    const avatarUrl = publicUser?.avatar_url ?? meta.avatar_url ?? meta.picture ?? "";

    // Active pass calculation
    const nowIso = new Date().toISOString();
    const activePass = entitlements.find((e) => (e.access_until as string) > nowIso);
    const isPaid = Boolean(activePass || orders.some((o) => o.status === "paid"));

    // Attempt stats
    const totalAttempts = attempts.length;
    const totalCorrect = attempts.filter((a) => a.correct).length;
    const accuracyRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const timeSamples = attempts.map((a) => a.time_taken_sec).filter((t): t is number => typeof t === "number" && t > 0);
    const avgTimeSec = timeSamples.length > 0 ? Math.round(timeSamples.reduce((a, b) => a + b, 0) / timeSamples.length) : 0;

    // Distinct active days
    const activeDaysSet = new Set<string>();
    attempts.forEach((a) => activeDaysSet.add(a.created_at.slice(0, 10)));
    activity.forEach((a) => activeDaysSet.add((a.answered_at as string).slice(0, 10)));

    // Latest activity
    let lastSeen = recentSession?.updated_at as string | undefined;
    if (!lastSeen && attempts.length > 0) lastSeen = attempts[0].created_at;
    if (!lastSeen && activity.length > 0) lastSeen = activity[0].answered_at as string;
    if (!lastSeen) lastSeen = authUser?.last_sign_in_at ?? authUser?.created_at ?? "";

    // Chapter breakdown
    const chapterMap = new Map<string, {
      chapter: string;
      subject: string;
      count: number;
      correct: number;
      lastAttempted: string;
    }>();

    activity.forEach((a) => {
      const ch = a.chapter_title as string;
      if (!ch) return;
      if (!chapterMap.has(ch)) {
        chapterMap.set(ch, {
          chapter: ch,
          subject: (a.subject_name as string) ?? "General",
          count: 0,
          correct: 0,
          lastAttempted: a.answered_at as string,
        });
      }
      const item = chapterMap.get(ch)!;
      item.count++;
      if (a.is_correct) item.correct++;
      if ((a.answered_at as string) > item.lastAttempted) {
        item.lastAttempted = a.answered_at as string;
      }
    });

    const chapters = [...chapterMap.values()].map((c) => ({
      ...c,
      accuracy: c.count > 0 ? Math.round((c.correct / c.count) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      profile: {
        id,
        name,
        email,
        avatarUrl,
        class: publicUser?.cl ?? "—",
        exam: publicUser?.exam ?? "—",
        rookieCoins: publicUser?.rookieCoinsEarned ?? 0,
        createdAt: authUser?.created_at ?? publicUser?.created_at ?? "",
        lastSeen,
      },
      pass: {
        isPaid,
        planId: activePass?.plan_id ?? (orders.find((o) => o.status === "paid")?.plan_id ?? "free"),
        accessUntil: activePass?.access_until ?? null,
      },
      kpis: {
        totalAttempts,
        totalCorrect,
        accuracyRate,
        avgTimeSec,
        activeDays: activeDaysSet.size,
        currentStreak: streak?.current_streak ?? 0,
        longestStreak: streak?.longest_streak ?? 0,
        totalTests: tests.length,
        totalOrders: orders.length,
      },
      recentAttempts: attempts.slice(0, 50).map((a) => ({
        id: a.id,
        questionId: a.question_id,
        correct: a.correct,
        timeTakenSec: a.time_taken_sec,
        createdAt: a.created_at,
      })),
      chapters,
      tests: tests.map((t) => ({
        id: t.id,
        title: t.title || "Custom Test",
        status: t.status,
        createdAt: t.created_at,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        planId: o.plan_id ?? "rookie_pass_yearly",
        amount: ((o.amount as number) ?? 0) / 100,
        status: o.status,
        createdAt: o.created_at,
        paidAt: o.paid_at,
      })),
    });
  } catch (err) {
    console.error("[user-detail]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

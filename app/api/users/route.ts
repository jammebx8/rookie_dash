import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const [authList, publicUsersRes, attRes, entRes, ordRes] = await Promise.all([
      sb.auth.admin.listUsers({ perPage: 1000 }),
      sb.from("users").select("id, name, email, cl, exam, avatar_url, rookieCoinsEarned, created_at").limit(1000),
      sb.from("attempts").select("student_id, created_at").order("created_at", { ascending: false }).limit(5000),
      sb.from("entitlements").select("user_id, plan_id, access_until"),
      sb.from("orders").select("user_id, status, plan_id"),
    ]);

    const authUsers = authList.data?.users ?? [];
    const publicUsers = publicUsersRes.data ?? [];
    const attempts = attRes.data ?? [];
    const entitlements = entRes.data ?? [];
    const orders = ordRes.data ?? [];

    const nowIso = new Date().toISOString();
    const paidUserMap = new Map<string, string>();
    entitlements.forEach((e) => {
      if ((e.access_until as string) > nowIso) paidUserMap.set(e.user_id as string, e.plan_id as string);
    });
    orders.forEach((o) => {
      if (o.status === "paid") paidUserMap.set(o.user_id as string, (o.plan_id as string) ?? "rookie_pass_yearly");
    });

    const publicUserMap = new Map<string, typeof publicUsers[0]>();
    publicUsers.forEach((p) => publicUserMap.set(p.id, p));

    const attemptsCountMap = new Map<string, number>();
    const lastAttemptMap = new Map<string, string>();
    attempts.forEach((a) => {
      const uid = a.student_id;
      if (!uid) return;
      attemptsCountMap.set(uid, (attemptsCountMap.get(uid) ?? 0) + 1);
      if (!lastAttemptMap.has(uid) || a.created_at > lastAttemptMap.get(uid)!) {
        lastAttemptMap.set(uid, a.created_at);
      }
    });

    const nowTime = Date.now();
    const ONE_DAY_MS = 24 * 3600 * 1000;

    const users = authUsers.map((u) => {
      const p = publicUserMap.get(u.id);
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const name = p?.name ?? meta.full_name ?? meta.name ?? meta.display_name ?? u.email?.split("@")[0] ?? u.id.slice(0, 8);
      const email = p?.email ?? u.email ?? "";
      const avatarUrl = p?.avatar_url ?? meta.avatar_url ?? meta.picture ?? "";
      const totalAttempts = attemptsCountMap.get(u.id) ?? 0;
      const lastSeen = lastAttemptMap.get(u.id) ?? u.last_sign_in_at ?? u.created_at;
      const isPaid = paidUserMap.has(u.id);
      const signupAgeMs = nowTime - new Date(u.created_at).getTime();

      return {
        userId: u.id,
        name,
        email,
        avatarUrl,
        class: p?.cl ?? "—",
        exam: p?.exam ?? "—",
        rookieCoins: p?.rookieCoinsEarned ?? 0,
        createdAt: u.created_at,
        totalAttempts,
        lastSeen,
        isPaid,
        planId: paidUserMap.get(u.id) ?? "free",
        isNew: signupAgeMs < ONE_DAY_MS,
      };
    });

    // Sort by most recently active first
    users.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

    return NextResponse.json({
      totalUsers: users.length,
      users,
    });
  } catch (err) {
    console.error("[all-users]", err);
    return NextResponse.json({ error: String(err), users: [] }, { status: 500 });
  }
}

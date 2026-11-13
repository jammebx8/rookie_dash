import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASS_GRANT_SECRET || "Lynx007@tiger";
const PLAN_ID = "rookie_pass_yearly";

interface ResolveUserResult {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  source: "public_users" | "auth_users";
}

/**
 * Resolves a user ID and details by searching public.users and auth.users
 */
async function resolveUserByEmail(
  sb: ReturnType<typeof createServerSupabaseClient>,
  cleanEmail: string
): Promise<ResolveUserResult | null> {
  // 1. Try public.users table
  try {
    const { data: publicUser, error: pubErr } = await sb
      .from("users")
      .select("id, email, name, avatar_url")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (!pubErr && publicUser?.id) {
      return {
        id: publicUser.id,
        email: publicUser.email || cleanEmail,
        name: publicUser.name || cleanEmail.split("@")[0],
        avatarUrl: publicUser.avatar_url || "",
        source: "public_users",
      };
    }
  } catch (err) {
    console.warn("[grant-pass] Error searching public.users:", err);
  }

  // 2. Fallback: Search auth.users via Supabase Admin API
  try {
    const { data, error: authErr } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (!authErr && data?.users) {
      const authUser = data.users.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );

      if (authUser) {
        const meta = (authUser.user_metadata ?? {}) as Record<string, string>;
        const name =
          meta.full_name ??
          meta.name ??
          meta.display_name ??
          authUser.email?.split("@")[0] ??
          "User";
        const avatarUrl = meta.avatar_url ?? meta.picture ?? "";

        return {
          id: authUser.id,
          email: authUser.email || cleanEmail,
          name,
          avatarUrl,
          source: "auth_users",
        };
      }
    }
  } catch (err) {
    console.warn("[grant-pass] Error searching auth.users:", err);
  }

  return null;
}

/**
 * Ensures the 'rookie_pass_yearly' plan exists in public.plans
 * to avoid foreign key violation on public.entitlements(plan_id).
 */
async function ensurePlanExists(
  sb: ReturnType<typeof createServerSupabaseClient>
) {
  try {
    const { data: existingPlan } = await sb
      .from("plans")
      .select("id")
      .eq("id", PLAN_ID)
      .maybeSingle();

    if (!existingPlan) {
      await sb.from("plans").insert({
        id: PLAN_ID,
        display_name: "Rookie Pass — 1 Year",
        price_paise: 29900,
        duration_days: 365,
        currency: "INR",
        active: true,
      });
    }
  } catch (err) {
    console.warn("[grant-pass] ensurePlanExists warning:", err);
  }
}

// ── GET: Look up a user or list active pass entitlements ──────────────────────
export async function GET(req: NextRequest) {
  try {
    const sb = createServerSupabaseClient();
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email");

    // 1. If looking up a specific user by email
    if (emailParam) {
      const cleanEmail = emailParam.trim().toLowerCase();
      const user = await resolveUserByEmail(sb, cleanEmail);

      if (!user) {
        return NextResponse.json(
          {
            found: false,
            error: `No user found registered with email "${emailParam}". Please ensure they have signed up on Rookie.AI first.`,
          },
          { status: 404 }
        );
      }

      // Check existing entitlement
      const { data: entitlement } = await sb
        .from("entitlements")
        .select("user_id, plan_id, access_until, granted_at")
        .eq("user_id", user.id)
        .eq("plan_id", PLAN_ID)
        .maybeSingle();

      const now = new Date();
      const hasActivePass =
        !!entitlement && new Date(entitlement.access_until) > now;
      const daysRemaining = hasActivePass
        ? Math.max(
            0,
            Math.ceil(
              (new Date(entitlement.access_until).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0;

      return NextResponse.json({
        found: true,
        user,
        hasActivePass,
        daysRemaining,
        entitlement: entitlement ?? null,
      });
    }

    // 2. If listing all pass holders
    const { data: entitlements, error: entErr } = await sb
      .from("entitlements")
      .select("user_id, plan_id, access_until, granted_at")
      .eq("plan_id", PLAN_ID)
      .order("granted_at", { ascending: false })
      .limit(200);

    if (entErr) {
      throw new Error(`Failed to query entitlements: ${entErr.message}`);
    }

    const items = entitlements || [];
    const userIds = items.map((e) => e.user_id);

    // Map user profiles
    const userMap = new Map<
      string,
      { email: string; name: string; avatarUrl: string }
    >();

    if (userIds.length > 0) {
      // Look up in public.users
      const { data: pubUsers } = await sb
        .from("users")
        .select("id, email, name, avatar_url")
        .in("id", userIds);

      (pubUsers || []).forEach(
        (u: { id: string; email?: string; name?: string; avatar_url?: string }) => {
          userMap.set(u.id, {
            email: u.email || "",
            name: u.name || (u.email ? u.email.split("@")[0] : "Student"),
            avatarUrl: u.avatar_url || "",
          });
        }
      );

      // For any missing from public.users, attempt auth.admin.listUsers
      const missingIds = userIds.filter((id) => !userMap.has(id));
      if (missingIds.length > 0) {
        try {
          const { data: authData } = await sb.auth.admin.listUsers({
            perPage: 1000,
          });
          (authData?.users || []).forEach((au) => {
            if (missingIds.includes(au.id) && !userMap.has(au.id)) {
              const meta = (au.user_metadata || {}) as Record<string, string>;
              userMap.set(au.id, {
                email: au.email || "",
                name:
                  meta.full_name ||
                  meta.name ||
                  (au.email ? au.email.split("@")[0] : "Student"),
                avatarUrl: meta.avatar_url || "",
              });
            }
          });
        } catch {
          // ignore fallback error
        }
      }
    }

    const now = new Date();
    const formattedPassHolders = items.map((e) => {
      const u = userMap.get(e.user_id) || {
        email: "Unknown User",
        name: "Student",
        avatarUrl: "",
      };
      const isActive = new Date(e.access_until) > now;
      const daysRemaining = isActive
        ? Math.max(
            0,
            Math.ceil(
              (new Date(e.access_until).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0;

      return {
        userId: e.user_id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatarUrl,
        planId: e.plan_id,
        grantedAt: e.granted_at,
        accessUntil: e.access_until,
        isActive,
        daysRemaining,
      };
    });

    return NextResponse.json({
      total: formattedPassHolders.length,
      activeCount: formattedPassHolders.filter((p) => p.isActive).length,
      passHolders: formattedPassHolders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[grant-pass GET]", msg);
    return NextResponse.json(
      { error: msg || "Failed to fetch pass information" },
      { status: 500 }
    );
  }
}

// ── POST: Grant Rookie Pass or Revoke Pass ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      adminPassword,
      durationDays = 365,
      note,
      action = "grant", // "grant" | "revoke"
    } = body;

    // 1. Validate Admin Password
    if (!adminPassword || typeof adminPassword !== "string") {
      return NextResponse.json(
        { error: "Admin password is required." },
        { status: 401 }
      );
    }

    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          error:
            "Invalid admin password. Authorization failed. Please verify the admin password.",
        },
        { status: 403 }
      );
    }

    // 2. Validate Email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid user email address is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const sb = createServerSupabaseClient();

    // 3. Resolve User
    const user = await resolveUserByEmail(sb, cleanEmail);
    if (!user) {
      return NextResponse.json(
        {
          error: `User with email "${cleanEmail}" was not found on Rookie.AI. Make sure the user has created an account or signed in at least once.`,
        },
        { status: 404 }
      );
    }

    // Ensure plan row exists
    await ensurePlanExists(sb);

    // 4. Handle REVOKE action
    if (action === "revoke") {
      const { error: revokeErr } = await sb
        .from("entitlements")
        .delete()
        .eq("user_id", user.id)
        .eq("plan_id", PLAN_ID);

      if (revokeErr) {
        throw new Error(`Failed to revoke pass: ${revokeErr.message}`);
      }

      return NextResponse.json({
        success: true,
        action: "revoked",
        message: `Rookie Pass access for ${user.email} (${user.name}) has been revoked.`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }

    // 5. Handle GRANT action
    const days = Math.max(1, parseInt(String(durationDays), 10) || 365);
    const now = new Date();

    // Check if user currently has an active pass to extend
    const { data: existingEntitlement } = await sb
      .from("entitlements")
      .select("access_until")
      .eq("user_id", user.id)
      .eq("plan_id", PLAN_ID)
      .maybeSingle();

    let baseTime = now.getTime();
    let wasExtended = false;

    if (existingEntitlement?.access_until) {
      const existingExpiry = new Date(existingEntitlement.access_until).getTime();
      if (existingExpiry > now.getTime()) {
        baseTime = existingExpiry;
        wasExtended = true;
      }
    }

    const newExpiryDate = new Date(baseTime + days * 24 * 60 * 60 * 1000);

    // Upsert entitlement in public.entitlements
    const { error: upsertErr } = await sb
      .from("entitlements")
      .upsert(
        {
          user_id: user.id,
          plan_id: PLAN_ID,
          access_until: newExpiryDate.toISOString(),
          granted_at: now.toISOString(),
        },
        { onConflict: "user_id, plan_id" }
      );

    if (upsertErr) {
      throw new Error(`Database error saving entitlement: ${upsertErr.message}`);
    }

    return NextResponse.json({
      success: true,
      action: wasExtended ? "extended" : "granted",
      message: wasExtended
        ? `Rookie Pass extended by ${days} days for ${user.email}! Access valid until ${newExpiryDate.toLocaleDateString("en-IN", { dateStyle: "long" })}.`
        : `Rookie Pass successfully granted to ${user.email}! Full paid access is now active until ${newExpiryDate.toLocaleDateString("en-IN", { dateStyle: "long" })}.`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      entitlement: {
        userId: user.id,
        planId: PLAN_ID,
        accessUntil: newExpiryDate.toISOString(),
        grantedAt: now.toISOString(),
        durationDays: days,
        note: note?.trim() || null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[grant-pass POST]", msg);
    return NextResponse.json(
      { error: msg || "Failed to grant Rookie Pass." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_PASS_GRANT_SECRET || "Lynx007@tiger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();
    const { data: userData, error: userError } = await sb.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userData.user;
    const now = new Date();
    const basePrice = 999;

    // 1. Check custom sale in app_metadata
    let activeCustomSale: {
      customPrice: number;
      customPricePaise: number;
      expiresAt: string;
      durationHours: number;
      reason: string;
      createdAt: string;
      remainingMs: number;
    } | null = null;

    const metaSale = (user.app_metadata as Record<string, any> | undefined)?.custom_sale;
    if (
      metaSale &&
      metaSale.is_active !== false &&
      new Date(metaSale.expires_at) > now &&
      Number(metaSale.custom_price_paise) > 0
    ) {
      activeCustomSale = {
        customPrice: Math.round(Number(metaSale.custom_price_paise) / 100),
        customPricePaise: Number(metaSale.custom_price_paise),
        expiresAt: metaSale.expires_at,
        durationHours: Number(metaSale.duration_hours) || 24,
        reason: metaSale.reason || "Custom Discount",
        createdAt: metaSale.created_at || now.toISOString(),
        remainingMs: Math.max(0, new Date(metaSale.expires_at).getTime() - now.getTime()),
      };
    }

    // Also check user_custom_sales table if available
    let tableExists = true;
    try {
      const { data: tableSales, error: tableErr } = await sb
        .from("user_custom_sales")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .gt("expires_at", now.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (tableErr) {
        tableExists = false;
      } else if (tableSales && tableSales.length > 0 && !activeCustomSale) {
        const s = tableSales[0];
        activeCustomSale = {
          customPrice: Math.round(Number(s.custom_price_paise) / 100),
          customPricePaise: Number(s.custom_price_paise),
          expiresAt: s.expires_at,
          durationHours: Number(s.duration_hours) || 24,
          reason: s.reason || "Custom Discount",
          createdAt: s.created_at,
          remainingMs: Math.max(0, new Date(s.expires_at).getTime() - now.getTime()),
        };
      }
    } catch {
      tableExists = false;
    }

    // 2. Check 48h welcome sale
    const signupMs = new Date(user.created_at).getTime();
    const welcomeEndMs = signupMs + 48 * 3600 * 1000;
    const isWelcomeLive = now.getTime() < welcomeEndMs;
    const welcomeRemainingMs = Math.max(0, welcomeEndMs - now.getTime());

    // 3. Determine effective price
    let effectivePrice = basePrice;
    let effectiveSaleType: "custom" | "welcome" | "none" = "none";

    if (activeCustomSale) {
      effectivePrice = activeCustomSale.customPrice;
      effectiveSaleType = "custom";
    } else if (isWelcomeLive) {
      effectivePrice = 399;
      effectiveSaleType = "welcome";
    }

    return NextResponse.json({
      userId,
      basePrice,
      effectivePrice,
      effectiveSaleType,
      activeCustomSale,
      welcomeSale: {
        isActive: isWelcomeLive,
        expiresAt: new Date(welcomeEndMs).toISOString(),
        remainingMs: welcomeRemainingMs,
        remainingHours: Number((welcomeRemainingMs / (3600 * 1000)).toFixed(1)),
      },
      tableExists,
    });
  } catch (err) {
    console.error("[custom-sale GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, customPrice, durationHours, adminPassword, reason } = body;

    // Validate admin password
    if (!adminPassword || adminPassword !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const priceNum = Number(customPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Valid customPrice in Rupees is required (e.g. 399)" }, { status: 400 });
    }

    const durationNum = Number(durationHours);
    if (isNaN(durationNum) || durationNum <= 0) {
      return NextResponse.json({ error: "Valid durationHours is required (e.g. 24 or 48)" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();
    const { data: userData, error: userError } = await sb.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "User not found in Supabase auth" }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationNum * 3600 * 1000).toISOString();
    const customPricePaise = Math.round(priceNum * 100);

    const saleRecord = {
      custom_price_paise: customPricePaise,
      expires_at: expiresAt,
      duration_hours: durationNum,
      reason: reason?.trim() || `Admin custom sale (₹${priceNum} for ${durationNum}h)`,
      created_at: now.toISOString(),
      is_active: true,
    };

    // 1. Update auth.users app_metadata (immediate, guaranteed zero-downtime)
    const existingMeta = (userData.user.app_metadata as Record<string, any>) || {};
    const { error: updateError } = await sb.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existingMeta,
        custom_sale: saleRecord,
      },
    });

    if (updateError) {
      throw new Error(`Failed to update app_metadata: ${updateError.message}`);
    }

    // 2. Insert into public.user_custom_sales table if present
    try {
      await sb.from("user_custom_sales").update({ is_active: false }).eq("user_id", userId);
      await sb.from("user_custom_sales").insert({
        user_id: userId,
        plan_id: "rookie_pass_yearly",
        custom_price_paise: customPricePaise,
        starts_at: now.toISOString(),
        expires_at: expiresAt,
        duration_hours: durationNum,
        reason: saleRecord.reason,
        created_by: "admin",
        is_active: true,
      });
    } catch (e) {
      console.warn("user_custom_sales table update error (table may need migration):", e);
    }

    return NextResponse.json({
      success: true,
      message: `Custom sale activated for ₹${priceNum} for ${durationNum} hours`,
      sale: {
        userId,
        customPrice: priceNum,
        customPricePaise,
        startsAt: now.toISOString(),
        expiresAt,
        durationHours: durationNum,
        reason: saleRecord.reason,
      },
    });
  } catch (err) {
    console.error("[custom-sale POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, adminPassword } = body;

    if (!adminPassword || adminPassword !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();
    const { data: userData } = await sb.auth.admin.getUserById(userId);
    if (userData?.user) {
      const existingMeta = (userData.user.app_metadata as Record<string, any>) || {};
      await sb.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...existingMeta,
          custom_sale: null,
        },
      });
    }

    try {
      await sb.from("user_custom_sales").update({ is_active: false }).eq("user_id", userId);
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Custom sale has been deactivated for this user",
    });
  } catch (err) {
    console.error("[custom-sale DELETE]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

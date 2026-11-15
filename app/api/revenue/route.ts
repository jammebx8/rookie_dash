import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserProfiles } from "@/lib/getUserProfiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createServerSupabaseClient();

    const now        = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Fetch raw data in parallel ─────────────────────────────────────────
    const [ordersRes, entitlementsRes, usersRes, activityRes, testsRes] = await Promise.all([
      sb
        .from("orders")
        .select("id, user_id, plan_id, amount, status, created_at, paid_at")
        .order("created_at", { ascending: false })
        .limit(5000),

      sb
        .from("entitlements")
        .select("user_id, plan_id, access_until, granted_at")
        .limit(5000),

      sb.auth.admin.listUsers({ perPage: 1000 }),

      sb
        .from("user_activity")
        .select("user_id, answered_at, chapter_title, subject_name")
        .not("user_id", "is", null)
        .limit(50000),

      sb
        .from("test_attempts")
        .select("id, user_id, title, created_at, status")
        .not("user_id", "is", null)
        .limit(10000),
    ]);

    if (ordersRes.error)       throw new Error(`orders: ${ordersRes.error.message}`);
    if (entitlementsRes.error) throw new Error(`entitlements: ${entitlementsRes.error.message}`);

    const orders       = ordersRes.data       ?? [];
    const entitlements = entitlementsRes.data ?? [];
    const authUsers    = usersRes.data?.users ?? [];
    const allActivity  = activityRes.data     ?? [];
    const allTests     = testsRes.data        ?? [];

    // Map of user signup dates and pricing from auth.users
    const userSignupMap = new Map<string, string>();
    const userSaleMap = new Map<string, { currentPrice: number; saleType: "custom" | "welcome" | "none"; saleHoursLeft: number; saleExpiresAt: string | null }>();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
    const nowTime = Date.now();

    authUsers.forEach((u) => {
      userSignupMap.set(u.id, u.created_at);
      const appMeta = (u.app_metadata ?? {}) as Record<string, any>;
      const signupAgeMs = nowTime - new Date(u.created_at).getTime();
      let currentPrice = 999;
      let saleType: "custom" | "welcome" | "none" = "none";
      let saleExpiresAt: string | null = null;
      let saleRemainingMs = 0;
      let saleHoursLeft = 0;

      const customSale = appMeta.custom_sale;
      if (
        customSale &&
        customSale.is_active !== false &&
        new Date(customSale.expires_at).getTime() > nowTime &&
        Number(customSale.custom_price_paise) > 0
      ) {
        currentPrice = Math.round(Number(customSale.custom_price_paise) / 100);
        saleType = "custom";
        saleExpiresAt = customSale.expires_at;
        saleRemainingMs = Math.max(0, new Date(customSale.expires_at).getTime() - nowTime);
        saleHoursLeft = Number((saleRemainingMs / (3600 * 1000)).toFixed(1));
      } else if (signupAgeMs < FORTY_EIGHT_HOURS_MS) {
        currentPrice = 399;
        saleType = "welcome";
        const welcomeEndMs = new Date(u.created_at).getTime() + FORTY_EIGHT_HOURS_MS;
        saleExpiresAt = new Date(welcomeEndMs).toISOString();
        saleRemainingMs = Math.max(0, welcomeEndMs - nowTime);
        saleHoursLeft = Number((saleRemainingMs / (3600 * 1000)).toFixed(1));
      }

      userSaleMap.set(u.id, { currentPrice, saleType, saleHoursLeft, saleExpiresAt });
    });

    // ── Classify orders ────────────────────────────────────────────────────
    const allCreated = orders; // every order row = one checkout page hit
    const paid       = orders.filter((o) => o.status === "paid");

    // ── Conversion funnel ──────────────────────────────────────────────────
    const checkoutStarts  = allCreated.length;
    const paidCount       = paid.length;
    const conversionRate  = checkoutStarts > 0
      ? Math.round((paidCount / checkoutStarts) * 100)
      : 0;

    // ── Revenue numbers (paise → rupees) ──────────────────────────────────
    const PAISE = 100;
    const totalRevenuePaise = paid.reduce((s, o) => s + ((o.amount as number) ?? 0), 0);
    const totalRevenue      = totalRevenuePaise / PAISE;

    const mrr = paid
      .filter((o) => new Date(o.paid_at as string) >= monthStart)
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const prevMrr = paid
      .filter((o) => {
        const d = new Date(o.paid_at as string);
        return d >= prevMonthStart && d < prevMonthEnd;
      })
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const arr = mrr * 12;
    const mrrGrowth = prevMrr > 0
      ? Math.round(((mrr - prevMrr) / prevMrr) * 100)
      : null;

    // ── Paying users (unique) ──────────────────────────────────────────────
    const uniquePayingUsers = new Set(paid.map((o) => o.user_id as string)).size;

    // Active passes (expires in the future)
    const activePasses = entitlements.filter(
      (e) => new Date(e.access_until as string) > now
    ).length;

    // Churned = paid but no active entitlement
    const payingUserIds  = new Set(paid.map((o) => o.user_id as string));
    const activeUserIds  = new Set(
      entitlements
        .filter((e) => new Date(e.access_until as string) > now)
        .map((e) => e.user_id as string)
    );
    const churnedCount = [...payingUserIds].filter((id) => !activeUserIds.has(id)).length;
    const churnRate    = uniquePayingUsers > 0
      ? Math.round((churnedCount / uniquePayingUsers) * 100)
      : 0;

    // LTV (simple: total revenue / unique paying users)
    const avgLtv = uniquePayingUsers > 0
      ? Math.round(totalRevenue / uniquePayingUsers)
      : 0;

    // ── Today & this week ──────────────────────────────────────────────────
    const revenueToday = paid
      .filter((o) => new Date(o.paid_at as string) >= todayStart)
      .reduce((s, o) => s + ((o.amount as number) ?? 0), 0) / PAISE;

    const checkoutToday = allCreated.filter(
      (o) => new Date(o.created_at as string) >= todayStart
    ).length;

    const paidToday = paid.filter(
      (o) => new Date(o.paid_at as string) >= todayStart
    ).length;

    // ── 30-day daily revenue timeseries ───────────────────────────────────
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    paid.forEach((o) => {
      const day = (o.paid_at as string | null)?.slice(0, 10);
      if (day && day in dailyMap) {
        dailyMap[day] += (o.amount as number) / PAISE;
      }
    });
    const revenueTimeseries = Object.entries(dailyMap).map(([date, revenue]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: Math.round(revenue),
    }));

    // ── 30-day daily checkout starts timeseries ────────────────────────────
    const checkoutMap: Record<string, number> = {};
    revenueTimeseries.forEach(({ date }) => { checkoutMap[date] = 0; });
    allCreated.forEach((o) => {
      const day = (o.created_at as string).slice(0, 10);
      if (day in checkoutMap) checkoutMap[day]++;
    });
    const checkoutTimeseries = Object.entries(checkoutMap).map(([date, count]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      count,
    }));

    // ── Item 9: Free-to-Paid Conversion Deep-Dive ────────────────────────────
    // Earliest paid order per user
    const firstPaidOrders = new Map<string, typeof paid[0]>();
    paid.forEach((o) => {
      const uid = o.user_id as string;
      if (!firstPaidOrders.has(uid) || (o.paid_at as string) < (firstPaidOrders.get(uid)!.paid_at as string)) {
        firstPaidOrders.set(uid, o);
      }
    });

    interface ConversionEntry {
      userId: string;
      signupAt: string;
      paidAt: string;
      daysToConvert: number;
      questionsBeforePaying: number;
      testsBeforePaying: number;
      triggerFeature: string;
      amount: number;
      planId: string;
    }

    const conversionEntries: ConversionEntry[] = [];
    const daysBuckets = {
      under24h: 0,
      days1to3: 0,
      days4to7: 0,
      days8to14: 0,
      days15plus: 0,
    };

    firstPaidOrders.forEach((o, uid) => {
      const paidAt = o.paid_at as string;
      const signupAt = userSignupMap.get(uid) || (o.created_at as string);
      const days = Math.max(0, (new Date(paidAt).getTime() - new Date(signupAt).getTime()) / 86400000);
      const roundedDays = Number(days.toFixed(1));

      if (days < 1) daysBuckets.under24h++;
      else if (days <= 3) daysBuckets.days1to3++;
      else if (days <= 7) daysBuckets.days4to7++;
      else if (days <= 14) daysBuckets.days8to14++;
      else daysBuckets.days15plus++;

      // Pre-conversion questions
      const userActsBefore = allActivity.filter((a) => a.user_id === uid && (a.answered_at as string) < paidAt);
      const questionsBefore = userActsBefore.length;

      // Pre-conversion tests
      const userTestsBefore = allTests.filter((t) => t.user_id === uid && (t.created_at as string) < paidAt);
      const testsBefore = userTestsBefore.length;

      // Trigger feature / last activity before payment
      let lastActDesc: string | null = null;
      let lastActTs: string | null = null;
      for (const a of userActsBefore) {
        const ts = a.answered_at as string;
        if (!lastActTs || ts > lastActTs) {
          lastActTs = ts;
          lastActDesc = `${a.subject_name ?? "Subject"} · ${a.chapter_title ?? "Practice"}`;
        }
      }
      for (const t of userTestsBefore) {
        const ts = t.created_at as string;
        if (!lastActTs || ts > lastActTs) {
          lastActTs = ts;
          lastActDesc = `Custom Test · ${t.title || "Custom Test"}`;
        }
      }

      conversionEntries.push({
        userId: uid,
        signupAt,
        paidAt,
        daysToConvert: roundedDays,
        questionsBeforePaying: questionsBefore,
        testsBeforePaying: testsBefore,
        triggerFeature: lastActDesc || (questionsBefore > 0 ? "Question Viewer" : testsBefore > 0 ? "Custom Test" : "Direct Upgrade"),
        amount: ((o.amount as number) ?? 0) / PAISE,
        planId: (o.plan_id as string) ?? "rookie_pass_yearly",
      });
    });

    conversionEntries.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

    // Compute averages & medians
    const allDays = conversionEntries.map((e) => e.daysToConvert).sort((a, b) => a - b);
    const avgDaysToConvert = allDays.length > 0 ? Number((allDays.reduce((a, b) => a + b, 0) / allDays.length).toFixed(1)) : 0;
    const medianDaysToConvert = allDays.length > 0 ? allDays[Math.floor(allDays.length / 2)] : 0;

    const allQuestions = conversionEntries.map((e) => e.questionsBeforePaying);
    const avgQuestionsBefore = allQuestions.length > 0 ? Math.round(allQuestions.reduce((a, b) => a + b, 0) / allQuestions.length) : 0;

    const allTestsCount = conversionEntries.map((e) => e.testsBeforePaying);
    const avgTestsBefore = allTestsCount.length > 0 ? Number((allTestsCount.reduce((a, b) => a + b, 0) / allTestsCount.length).toFixed(1)) : 0;

    // ── Item 3: Checkout Openers (Single & Multiple) for Revenue tab ─────────
    const userCheckoutMap = new Map<string, {
      count: number;
      paid: boolean;
      plans: Set<string>;
      lastCheckoutAt: string;
      lastAmount: number;
    }>();

    allCreated.forEach((o) => {
      const uid = o.user_id as string;
      if (!uid) return;
      if (!userCheckoutMap.has(uid)) {
        userCheckoutMap.set(uid, {
          count: 0,
          paid: false,
          plans: new Set(),
          lastCheckoutAt: o.created_at as string,
          lastAmount: ((o.amount as number) ?? 0) / PAISE,
        });
      }
      const item = userCheckoutMap.get(uid)!;
      item.count++;
      if (o.status === "paid") item.paid = true;
      if (o.plan_id) item.plans.add(o.plan_id as string);
      if ((o.created_at as string) > item.lastCheckoutAt) {
        item.lastCheckoutAt = o.created_at as string;
        item.lastAmount = ((o.amount as number) ?? 0) / PAISE;
      }
    });

    // All unique checkout users sorted by most recent checkout first
    const allCheckoutEntries = [...userCheckoutMap.entries()]
      .sort((a, b) => b[1].lastCheckoutAt.localeCompare(a[1].lastCheckoutAt));

    const multiCheckoutEntries = allCheckoutEntries.filter(([_, v]) => v.count > 1);

    // Profile enrichment for all users involved in conversions, checkouts, and paid orders
    const uidsToEnrich = [
      ...conversionEntries.map((c) => c.userId),
      ...[...userCheckoutMap.keys()],
      ...paid.map((o) => o.user_id as string),
    ].filter(Boolean);
    const profileMap = await getUserProfiles([...new Set(uidsToEnrich)]);

    const enrichedConvertedUsers = conversionEntries.map((c) => {
      const p = profileMap.get(c.userId);
      return {
        ...c,
        name: p?.name ?? c.userId.slice(0, 8),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
      };
    });

    const enrichedMultiCheckoutUsers = multiCheckoutEntries.map(([uid, v]) => {
      const p = profileMap.get(uid);
      const isPaid = v.paid || payingUserIds.has(uid);
      const sale = userSaleMap.get(uid);
      return {
        userId: uid,
        name: p?.name ?? uid.slice(0, 8),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        checkoutCount: v.count,
        isPaid,
        status: isPaid ? ("paid" as const) : ("abandoned" as const),
        planId: [...v.plans].join(", ") || "rookie_pass_yearly",
        lastCheckoutAt: v.lastCheckoutAt,
        lastAmount: v.lastAmount,
        currentPrice: sale?.currentPrice ?? 999,
        saleType: sale?.saleType ?? "none",
        saleHoursLeft: sale?.saleHoursLeft ?? 0,
        saleExpiresAt: sale?.saleExpiresAt ?? null,
      };
    });

    const enrichedAllCheckoutUsers = allCheckoutEntries.map(([uid, v]) => {
      const p = profileMap.get(uid);
      const isPaid = v.paid || payingUserIds.has(uid);
      const sale = userSaleMap.get(uid);
      return {
        userId: uid,
        name: p?.name ?? uid.slice(0, 8),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        checkoutCount: v.count,
        isPaid,
        status: isPaid ? ("paid" as const) : ("abandoned" as const),
        planId: [...v.plans].join(", ") || "rookie_pass_yearly",
        lastCheckoutAt: v.lastCheckoutAt,
        lastAmount: v.lastAmount,
        currentPrice: sale?.currentPrice ?? 999,
        saleType: sale?.saleType ?? "none",
        saleHoursLeft: sale?.saleHoursLeft ?? 0,
        saleExpiresAt: sale?.saleExpiresAt ?? null,
      };
    });

    // Every single checkout event arranged as most recent first
    const enrichedAllCheckoutEvents = allCreated.map((o) => {
      const uid = o.user_id as string;
      const p = profileMap.get(uid);
      const isPaid = o.status === "paid" || payingUserIds.has(uid);
      const userTotal = userCheckoutMap.get(uid)?.count ?? 1;
      return {
        id: o.id as string,
        userId: uid,
        name: p?.name ?? (uid ? uid.slice(0, 8) : "Anonymous"),
        email: p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        planId: (o.plan_id as string) ?? "rookie_pass_yearly",
        amount: ((o.amount as number) ?? 0) / PAISE,
        status: (o.status as string) ?? "created",
        createdAt: o.created_at as string,
        paidAt: (o.paid_at as string) ?? null,
        userCheckoutCount: userTotal,
        isPaidUser: isPaid,
      };
    });

    // ── Recent paid orders (last 20) ───────────────────────────────────────
    const recentPaid = paid.slice(0, 20).map((o) => {
      const uid = o.user_id as string;
      const p = profileMap.get(uid);
      return {
        id:      (o.id as string).slice(0, 8),
        userId:  uid,
        name:    p?.name ?? uid.slice(0, 8),
        email:   p?.email ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        amount:  (o.amount as number) / PAISE,
        paidAt:  o.paid_at as string,
        planId:  (o.plan_id as string) ?? "rookie_pass_yearly",
      };
    });

    return Response.json({
      // Funnel
      checkoutStarts,
      paidCount,
      conversionRate,
      checkoutToday,
      paidToday,
      // Revenue
      totalRevenue:  Math.round(totalRevenue),
      mrr:           Math.round(mrr),
      prevMrr:       Math.round(prevMrr),
      arr:           Math.round(arr),
      mrrGrowth,
      revenueToday:  Math.round(revenueToday),
      // Users
      uniquePayingUsers,
      activePasses,
      churnedCount,
      churnRate,
      avgLtv,
      // Timeseries
      revenueTimeseries,
      checkoutTimeseries,
      // Recent
      recentPaid,

      // Free-to-paid conversion analysis
      freeToPaidConversion: {
        totalConvertedUsers: conversionEntries.length,
        avgDaysToConvert,
        medianDaysToConvert,
        avgQuestionsBefore,
        avgTestsBefore,
        daysBuckets: [
          { label: "< 24 hrs", count: daysBuckets.under24h, pct: conversionEntries.length > 0 ? Math.round((daysBuckets.under24h / conversionEntries.length) * 100) : 0 },
          { label: "1–3 days", count: daysBuckets.days1to3, pct: conversionEntries.length > 0 ? Math.round((daysBuckets.days1to3 / conversionEntries.length) * 100) : 0 },
          { label: "4–7 days", count: daysBuckets.days4to7, pct: conversionEntries.length > 0 ? Math.round((daysBuckets.days4to7 / conversionEntries.length) * 100) : 0 },
          { label: "8–14 days", count: daysBuckets.days8to14, pct: conversionEntries.length > 0 ? Math.round((daysBuckets.days8to14 / conversionEntries.length) * 100) : 0 },
          { label: "15+ days", count: daysBuckets.days15plus, pct: conversionEntries.length > 0 ? Math.round((daysBuckets.days15plus / conversionEntries.length) * 100) : 0 },
        ],
        convertedUsers: enrichedConvertedUsers,
      },

      // Multiple checkout openers
      multipleCheckoutOpeners: {
        totalMultiOpeners: multiCheckoutEntries.length,
        convertedCount: multiCheckoutEntries.filter(([_, v]) => v.paid).length,
        abandonedCount: multiCheckoutEntries.filter(([_, v]) => !v.paid).length,
        users: enrichedMultiCheckoutUsers,
      },

      // Complete checkout directory (all users who initiated checkout, single & multiple, + all events)
      checkoutDirectory: {
        totalCheckouts: allCreated.length,
        totalUsers: allCheckoutEntries.length,
        singleClickUsersCount: allCheckoutEntries.filter(([_, v]) => v.count === 1).length,
        multiClickUsersCount: allCheckoutEntries.filter(([_, v]) => v.count > 1).length,
        convertedCount: allCheckoutEntries.filter(([_, v]) => v.paid || payingUserIds.has(_[0])).length,
        abandonedCount: allCheckoutEntries.filter(([_, v]) => !v.paid && !payingUserIds.has(_[0])).length,
        users: enrichedAllCheckoutUsers,
        allEvents: enrichedAllCheckoutEvents,
      },
    });
  } catch (err) {
    console.error("[revenue]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

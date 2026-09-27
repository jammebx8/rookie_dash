import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Firebase stores session events in a "sessions" collection.
    // Each document has: userId, displayName, email, startedAt (Timestamp), durationSec
    // Adjust the collection name / field names to match your actual schema.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sessionsRef = collection(db, "sessions");
    const q = query(
      sessionsRef,
      where("startedAt", ">=", Timestamp.fromDate(startOfDay)),
      orderBy("startedAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    const seenUsers = new Map<
      string,
      { userId: string; displayName: string; email: string; durationSec: number; startedAt: string }
    >();

    snap.forEach((doc) => {
      const d = doc.data();
      const uid: string = d.userId ?? doc.id;
      if (!seenUsers.has(uid)) {
        seenUsers.set(uid, {
          userId: uid,
          displayName: d.displayName ?? d.email ?? uid.slice(0, 8),
          email: d.email ?? "",
          durationSec: d.durationSec ?? 0,
          startedAt:
            d.startedAt instanceof Timestamp
              ? d.startedAt.toDate().toISOString()
              : String(d.startedAt),
        });
      } else {
        // Accumulate total time on site for duplicate sessions
        const existing = seenUsers.get(uid)!;
        existing.durationSec += d.durationSec ?? 0;
      }
    });

    const usersToday = Array.from(seenUsers.values());
    const totalVisitors = usersToday.length;
    const avgDurationSec =
      totalVisitors > 0
        ? Math.round(
            usersToday.reduce((s, u) => s + u.durationSec, 0) / totalVisitors
          )
        : 0;

    return Response.json({ totalVisitors, avgDurationSec, usersToday });
  } catch (err) {
    console.error("[users-today]", err);
    // Return a graceful empty payload so the dashboard still renders
    return Response.json(
      { totalVisitors: 0, avgDurationSec: 0, usersToday: [], error: "Firebase unavailable" },
      { status: 200 }
    );
  }
}

/**
 * Fetches auth.users profiles for a list of UUIDs using the Admin API.
 * Requires SUPABASE_SERVICE_ROLE_KEY — never call from the browser.
 *
 * Returns a map of userId → { name, email, avatarUrl }
 * Falls back gracefully: missing fields default to empty strings.
 */

import { createServerSupabaseClient } from "@/lib/supabase";

export interface UserProfile {
  id:        string;
  name:      string;   // display_name → user_metadata.full_name → email prefix
  email:     string;
  avatarUrl: string;   // user_metadata.avatar_url (Google / GitHub OAuth)
}

export async function getUserProfiles(
  userIds: string[]
): Promise<Map<string, UserProfile>> {
  const profileMap = new Map<string, UserProfile>();
  if (userIds.length === 0) return profileMap;

  try {
    const sb = createServerSupabaseClient();

    // listUsers is paginated — fetch up to 1000 at once (Supabase max per page).
    // For dashboards with <1000 active users per day this single call is enough.
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });

    if (error) {
      console.error("[getUserProfiles] admin.listUsers error:", error.message);
      return profileMap;
    }

    const idSet = new Set(userIds);

    for (const user of data.users) {
      if (!idSet.has(user.id)) continue;

      const meta      = (user.user_metadata ?? {}) as Record<string, string>;
      const name      = meta.full_name
                     ?? meta.name
                     ?? meta.display_name
                     ?? user.email?.split("@")[0]
                     ?? user.id.slice(0, 8);
      const avatarUrl = meta.avatar_url ?? meta.picture ?? "";

      profileMap.set(user.id, {
        id:        user.id,
        name,
        email:     user.email ?? "",
        avatarUrl,
      });
    }
  } catch (err) {
    console.error("[getUserProfiles] unexpected error:", err);
  }

  return profileMap;
}

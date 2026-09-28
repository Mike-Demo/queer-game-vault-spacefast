/**
 * GET /api/public/profile/[username] — a public profile and its game lists.
 * Private or missing profiles → { profile: null, entries: [] }.
 * Mirrors `getProfileByUsername` from src/lib/tracking.functions.ts.
 */
import { apiError, json, withErrors } from "../../../_core/http";
import { all, first } from "../../../_core/db";
import { initRequest, type RouteContext } from "../../../_core/request";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "GET") return apiError(405, "invalid_request", "Method not allowed.");

  const raw = typeof context.params["username"] === "string" ? context.params["username"] : "";
  const username = raw.trim().slice(0, 24);
  if (!USERNAME_PATTERN.test(username)) return json({ profile: null, entries: [] });

  const profile = await first(
    env.db,
    `SELECT id, username, display_name, bio, avatar_url, created_at, profile_visibility
     FROM profiles WHERE LOWER(username) = LOWER(?)`,
    username,
  );
  if (!profile || profile["profile_visibility"] !== "public") {
    return json({ profile: null, entries: [] });
  }

  // Entries are keyed by the profile's user id (profiles.id = users.id).
  const profileId = String(profile["id"] ?? "");
  const rows = await all(
    env.db,
    `SELECT igdb_id, game_slug, title, cover_url, status, updated_at
     FROM game_entries WHERE user_id = ? ORDER BY updated_at DESC`,
    profileId,
  );

  return json({
    profile: {
      username: typeof profile["username"] === "string" ? profile["username"] : username,
      displayName: typeof profile["display_name"] === "string" ? profile["display_name"] : null,
      bio: typeof profile["bio"] === "string" ? profile["bio"] : null,
      avatarUrl: typeof profile["avatar_url"] === "string" ? profile["avatar_url"] : null,
      joinedAt: profile["created_at"] === null ? null : new Date(Number(profile["created_at"])).toISOString(),
    },
    entries: rows.map((row) => ({
      igdbId: Number(row["igdb_id"]),
      gameSlug: String(row["game_slug"]),
      title: String(row["title"]),
      coverUrl: row["cover_url"] === null ? null : String(row["cover_url"]),
      status: row["status"],
      updatedAt: new Date(Number(row["updated_at"])).toISOString(),
    })),
  });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

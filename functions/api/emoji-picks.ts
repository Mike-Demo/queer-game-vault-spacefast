/**
 * /api/emoji-picks — the signed-in visitor's saved oracle picks.
 * GET → EmojiPick[] (latest 20).
 * POST { emojis, gameSlug, title, coverUrl, reason } (same `saveInput`
 * validation as the original) → { ok: true }.
 */
import { apiError, InputError, json, withErrors } from "../_core/http";
import { requireUser } from "../_core/auth";
import { all, newId, run } from "../_core/db";
import { initRequest, type RouteContext } from "../_core/request";
import { EMOJI_MEANINGS, MAX_EMOJIS, MIN_EMOJIS } from "../_core/oracle";

const GAME_SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

function parseEmojis(emojis: unknown): string[] {
  if (!Array.isArray(emojis)) throw new InputError("invalid_request", "Pick some emojis first.");
  if (emojis.length < MIN_EMOJIS || emojis.length > MAX_EMOJIS) {
    throw new InputError("invalid_request", `Pick between ${MIN_EMOJIS} and ${MAX_EMOJIS} different emojis.`);
  }
  for (const emoji of emojis) {
    if (typeof emoji !== "string" || !EMOJI_MEANINGS.has(emoji)) {
      throw new InputError("invalid_request", "One of those emojis is not on the board.");
    }
  }
  if (new Set(emojis).size !== emojis.length) {
    throw new InputError("invalid_request", "Pick each emoji only once.");
  }
  return emojis as string[];
}

function validUrl(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new InputError("invalid_request", "Cover URL must be a URL or null.");
  if (value.length > max) throw new InputError("invalid_request", "Cover URL is too long.");
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new InputError("invalid_request", "Cover URL must be a URL or null.");
    }
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("invalid_request", "Cover URL must be a URL or null.");
  }
  return value;
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  const userId = await requireUser(env, request);

  if (request.method === "GET") {
    const rows = await all(
      env.db,
      `SELECT id, emojis, game_slug, title, cover_url, reason, created_at
       FROM emoji_picks WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      userId,
    );
    return json(
      rows.map((row) => ({
        id: row["id"],
        emojis: JSON.parse(String(row["emojis"])) as string[],
        gameSlug: row["game_slug"],
        title: row["title"],
        coverUrl: row["cover_url"],
        reason: row["reason"],
        createdAt: new Date(Number(row["created_at"])).toISOString(),
      })),
    );
  }

  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }

  const emojis = parseEmojis(input["emojis"]);
  const gameSlug = typeof input["gameSlug"] === "string" ? input["gameSlug"] : "";
  if (!GAME_SLUG_PATTERN.test(gameSlug)) throw new InputError("invalid_request", "Invalid game.");
  const title = typeof input["title"] === "string" ? input["title"].trim() : "";
  if (title.length < 1 || title.length > 300) throw new InputError("invalid_request", "Invalid title.");
  const coverUrl = validUrl(input["coverUrl"], 500);
  const reason = typeof input["reason"] === "string" ? input["reason"].trim() : "";
  if (reason.length < 1 || reason.length > 240) throw new InputError("invalid_request", "Invalid reason.");

  try {
    await run(
      env.db,
      `INSERT INTO emoji_picks (id, user_id, emojis, game_slug, title, cover_url, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      userId,
      JSON.stringify(emojis),
      gameSlug,
      title,
      coverUrl,
      reason,
      Date.now(),
    );
  } catch {
    throw new InputError("internal_error", "Your pick could not be saved.");
  }
  return json({ ok: true });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

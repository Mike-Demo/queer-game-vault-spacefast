/**
 * /api/library — the signed-in visitor's game tracking.
 * GET → GameEntry[] ordered by updated_at desc.
 * POST { igdbId, gameSlug, title, coverUrl?, status | null } → upsert on
 * (user_id, igdb_id), or delete when status is null → GameEntry | null.
 * Validation messages mirror src/lib/tracking.functions.ts.
 */
import { apiError, InputError, json, withErrors } from "../_core/http";
import { requireUser } from "../_core/auth";
import { all, first, newId, run, type SpacefastDb } from "../_core/db";
import { initRequest, type RouteContext } from "../_core/request";

const TRACK_STATUSES = ["playing", "completed", "wishlist", "dropped"] as const;
type TrackStatus = (typeof TRACK_STATUSES)[number];

function isTrackStatus(value: unknown): value is TrackStatus {
  return typeof value === "string" && (TRACK_STATUSES as readonly string[]).includes(value);
}

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim().slice(0, max);
  return next.length === 0 ? null : next;
}

interface EntryRow {
  igdb_id: number;
  game_slug: string;
  title: string;
  cover_url: string | null;
  status: string;
  updated_at: number;
}

function toEntry(row: Record<string, unknown>): {
  igdbId: number;
  gameSlug: string;
  title: string;
  coverUrl: string | null;
  status: TrackStatus;
  updatedAt: string;
} {
  return {
    igdbId: Number(row["igdb_id"]),
    gameSlug: String(row["game_slug"]),
    title: String(row["title"]),
    coverUrl: row["cover_url"] === null ? null : String(row["cover_url"]),
    status: row["status"] as TrackStatus,
    updatedAt: new Date(Number(row["updated_at"])).toISOString(),
  };
}

async function listEntries(db: SpacefastDb, userId: string) {
  const rows = await all(
    db,
    `SELECT igdb_id, game_slug, title, cover_url, status, updated_at
     FROM game_entries WHERE user_id = ? ORDER BY updated_at DESC`,
    userId,
  );
  return rows.map(toEntry);
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  const userId = await requireUser(env, request);

  if (request.method === "GET") {
    return json(await listEntries(env.db, userId));
  }

  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  let input: {
    igdbId?: unknown;
    gameSlug?: unknown;
    title?: unknown;
    coverUrl?: unknown;
    status?: unknown;
  };
  try {
    input = (await request.json()) as typeof input;
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }

  const igdbId = Math.trunc(Number(input?.igdbId));
  if (!Number.isFinite(igdbId) || igdbId <= 0) throw new InputError("invalid_request", "A valid game is required.");
  const gameSlug = trimmed(input?.gameSlug, 200);
  const title = trimmed(input?.title, 300);
  if (!gameSlug || !title) throw new InputError("invalid_request", "A valid game is required.");
  const status = input?.status ?? null;
  if (status !== null && !isTrackStatus(status)) throw new InputError("invalid_request", "Unknown status.");
  const coverUrl = trimmed(input?.coverUrl, 500);

  if (status === null) {
    await run(env.db, "DELETE FROM game_entries WHERE user_id = ? AND igdb_id = ?", userId, igdbId);
    return json(null);
  }

  const now = Date.now();
  await run(
    env.db,
    `INSERT INTO game_entries (id, user_id, igdb_id, game_slug, title, cover_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE game_slug = VALUES(game_slug), title = VALUES(title),
       cover_url = VALUES(cover_url), status = VALUES(status), updated_at = VALUES(updated_at)`,
    newId(),
    userId,
    igdbId,
    gameSlug,
    title,
    coverUrl,
    status,
    now,
    now,
  );
  const row = await first(
    env.db,
    "SELECT igdb_id, game_slug, title, cover_url, status, updated_at FROM game_entries WHERE user_id = ? AND igdb_id = ?",
    userId,
    igdbId,
  );
  if (!row) throw new InputError("internal_error", "That game could not be saved. Please try again.");
  return json(toEntry(row));
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

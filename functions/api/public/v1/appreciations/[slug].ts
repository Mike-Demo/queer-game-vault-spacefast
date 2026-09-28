/**
 * /api/public/v1/appreciations/[slug] — pixel-heart counts backed by D1.
 * GET → { slug, total } (missing → total 0).
 * POST → atomic increment → { slug, total }.
 */
import { withErrors } from "../../../../_core/http";
import { first, run } from "../../../../_core/db";
import { initRequest, type RouteContext } from "../../../../_core/request";
import {
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "../../../../_core/public-api";

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;

  const slug = typeof context.params["slug"] === "string" ? context.params["slug"] : "";
  if (!SLUG_PATTERN.test(slug)) return errorResponse(404, "not_found", "Game not found.", rate.headers);

  try {
    if (request.method === "GET") {
      const row = await first(env.db, "SELECT total FROM game_appreciations WHERE game_slug = ?", slug);
      const total = row ? Number(row["total"]) : 0;
      return jsonResponse({ slug, total }, 200, rate.headers);
    }
    if (request.method === "POST") {
      const now = Date.now();
      await run(
        env.db,
        `INSERT INTO game_appreciations (game_slug, total, updated_at)
         VALUES (?, 1, ?)
         ON DUPLICATE KEY UPDATE total = total + 1, updated_at = ?`,
        slug,
        now,
        now,
      );
      const row = await first(env.db, "SELECT total FROM game_appreciations WHERE game_slug = ?", slug);
      return jsonResponse({ slug, total: row ? Number(row["total"]) : 0 }, 200, rate.headers);
    }
    return errorResponse(405, "invalid_request", "Method not allowed.");
  } catch {
    return errorResponse(503, "service_unavailable", "Appreciations temporarily unavailable.", rate.headers);
  }
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

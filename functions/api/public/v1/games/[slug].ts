/** GET /api/public/v1/games/[slug] — one game with full public metadata. */
import { withErrors } from "../../../../_core/http";
import { initRequest, type RouteContext } from "../../../../_core/request";
import { sanityFetch } from "../../../../_core/sanity";
import {
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
  toPublicGameDetail,
  type GameDetail,
} from "../../../../_core/public-api";
import { gameBySlugQuery } from "../../../../_core/queries";

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return errorResponse(405, "invalid_request", "Method not allowed.");

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;

  const slug = typeof context.params["slug"] === "string" ? context.params["slug"] : "";
  if (!SLUG_PATTERN.test(slug)) return errorResponse(404, "not_found", "Game not found.", rate.headers);
  try {
    const game = await sanityFetch<GameDetail | null>(gameBySlugQuery, { slug });
    const body = game ? toPublicGameDetail(game) : null;
    return body
      ? jsonResponse(body, 200, rate.headers)
      : errorResponse(404, "not_found", "Game not found.", rate.headers);
  } catch {
    return errorResponse(503, "service_unavailable", "Catalog temporarily unavailable.", rate.headers);
  }
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

/** GET /api/public/v1/collections/[slug] — one collection and its games. */
import { withErrors } from "../../../../_core/http";
import { initRequest, type RouteContext } from "../../../../_core/request";
import { sanityFetch } from "../../../../_core/sanity";
import {
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
  toPublicCollection,
  toPublicGame,
  type CollectionDetail,
} from "../../../../_core/public-api";
import { collectionBySlugQuery } from "../../../../_core/queries";

const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return errorResponse(405, "invalid_request", "Method not allowed.");

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;

  const slug = typeof context.params["slug"] === "string" ? context.params["slug"] : "";
  if (!SLUG_PATTERN.test(slug)) return errorResponse(404, "not_found", "Collection not found.", rate.headers);
  try {
    const collection = await sanityFetch<CollectionDetail | null>(collectionBySlugQuery, { slug });
    const summary = collection ? toPublicCollection(collection) : null;
    if (!collection || !summary) {
      return errorResponse(404, "not_found", "Collection not found.", rate.headers);
    }
    const games = collection.games.map(toPublicGame).filter((game) => game !== null);
    return jsonResponse({ ...summary, games }, 200, rate.headers);
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

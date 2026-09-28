/** GET /api/public/v1/collections — every published editorial collection. */
import { withErrors } from "../../../../_core/http";
import { initRequest, type RouteContext } from "../../../../_core/request";
import { sanityFetch } from "../../../../_core/sanity";
import {
  API_VERSION,
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
  toPublicCollection,
  type CollectionSummary,
} from "../../../../_core/public-api";
import { publishedCollectionsQuery } from "../../../../_core/queries";

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return errorResponse(405, "invalid_request", "Method not allowed.");

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;
  try {
    const rows = await sanityFetch<CollectionSummary[]>(publishedCollectionsQuery);
    const collections = rows.map(toPublicCollection).filter((row) => row !== null);
    return jsonResponse(
      { collections, total: collections.length, version: API_VERSION },
      200,
      rate.headers,
    );
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

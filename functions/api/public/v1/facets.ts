/** GET /api/public/v1/facets — genre, platform and theme filter values. */
import { withErrors } from "../../../_core/http";
import { initRequest, type RouteContext } from "../../../_core/request";
import { sanityFetch } from "../../../_core/sanity";
import {
  API_VERSION,
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "../../../_core/public-api";
import { discoverFacetsQuery } from "../../../_core/queries";

interface FacetRow {
  readonly name: string;
  readonly slug: string | null;
}

interface FacetsResult {
  readonly genres: FacetRow[];
  readonly platforms: FacetRow[];
  readonly themes: (string | null)[];
}

function cleanFacets(rows: FacetRow[]): { name: string; slug: string }[] {
  return rows
    .filter((row): row is { name: string; slug: string } => Boolean(row.slug))
    .map((row) => ({ name: row.name, slug: row.slug }));
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return errorResponse(405, "invalid_request", "Method not allowed.");

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;
  try {
    const facets = await sanityFetch<FacetsResult>(discoverFacetsQuery);
    const themes = (facets.themes ?? [])
      .filter((theme): theme is string => Boolean(theme))
      .sort((a, b) => a.localeCompare(b));
    return jsonResponse(
      {
        genres: cleanFacets(facets.genres ?? []),
        platforms: cleanFacets(facets.platforms ?? []),
        themes,
        version: API_VERSION,
      },
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

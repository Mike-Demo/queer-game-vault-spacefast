/** GET /api/content/related-games?id=&genreIds=a,b,c — up to 3 games sharing a genre. */
import { InputError, withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { relatedGamesQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  if (id.length < 1 || id.length > 200) {
    throw new InputError("invalid_request", "A game id is required.");
  }
  const rawGenreIds = params.get("genreIds") ?? "";
  const genreIds = rawGenreIds
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (genreIds.length > 20 || genreIds.some((gid) => gid.length > 200)) {
    throw new InputError("invalid_request", "Too many genre ids.");
  }
  if (genreIds.length === 0) return cached([]);
  const games = await sanityFetch<unknown[]>(relatedGamesQuery, { id, genreIds, limit: 3 });
  return cached(games);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

/** GET /api/content/game-collections?slug= — collections that include the game. */
import { InputError, withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { gameCollectionsBySlugQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (slug.length < 1 || slug.length > 200) {
    throw new InputError("invalid_request", "A game slug is required.");
  }
  const collections = await sanityFetch<unknown[]>(gameCollectionsBySlugQuery, { slug });
  return cached(collections);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

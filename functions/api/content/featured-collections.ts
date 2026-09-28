/** GET /api/content/featured-collections — featured collections, limit 4. */
import { withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { featuredCollectionsQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const collections = await sanityFetch<unknown[]>(featuredCollectionsQuery, { limit: 4 });
  return cached(collections);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

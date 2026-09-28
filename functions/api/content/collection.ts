/** GET /api/content/collection?slug= — one published collection with its games. */
import { InputError, withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { collectionBySlugQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (slug.length < 1 || slug.length > 200) {
    throw new InputError("invalid_request", "A collection slug is required.");
  }
  const collection = await sanityFetch<unknown>(collectionBySlugQuery, { slug });
  return cached(collection);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

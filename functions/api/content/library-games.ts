/** GET /api/content/library-games?offset=&limit= — every publicly visible game. */
import { InputError, withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { approvedGamesQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

function intParam(value: string | null, def: number, min: number, max: number, name: string): number {
  if (value === null || value === "") return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new InputError("invalid_request", `Invalid ${name}: must be an integer ${min}..${max}.`);
  }
  return n;
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const params = new URL(request.url).searchParams;
  const offset = intParam(params.get("offset"), 0, 0, 10000, "offset");
  const limit = intParam(params.get("limit"), 60, 1, 120, "limit");
  const games = await sanityFetch<unknown[]>(approvedGamesQuery, { offset, end: offset + limit });
  return cached(games);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

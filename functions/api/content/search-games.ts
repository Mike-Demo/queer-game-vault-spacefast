/** GET /api/content/search-games?term=&genre=&platform=&theme= — public discovery search. */
import { InputError, withErrors } from "../../_core/http";
import { initRequest, type RouteContext } from "../../_core/request";
import { sanityFetch } from "../../_core/sanity";
import { searchGamesQuery } from "../../_core/queries";

function cached(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=60" } });
}

function textParam(value: string | null, max: number, name: string): string {
  const text = value ?? "";
  if (text.length > max) throw new InputError("invalid_request", `Invalid ${name}: too long.`);
  return text;
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const params = new URL(request.url).searchParams;
  const term = textParam(params.get("term"), 120, "term").trim();
  const genre = textParam(params.get("genre"), 200, "genre");
  const platform = textParam(params.get("platform"), 200, "platform");
  const theme = textParam(params.get("theme"), 200, "theme");
  const games = await sanityFetch<unknown[]>(searchGamesQuery, {
    term: term.length > 0 ? `${term}*` : "",
    genre,
    platform,
    theme,
    limit: 48,
  });
  return cached(games);
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

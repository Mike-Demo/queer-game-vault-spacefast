/**
 * GET /api/public/v1/games — search or list public games.
 * Query: q, genre, platform, theme, year, limit (1..48, default 24),
 * offset (0..10000, default 0). Exact contract from src/lib/publicApi.ts.
 */
import { withErrors } from "../../../../_core/http";
import { initRequest, type RouteContext } from "../../../../_core/request";
import { sanityFetch } from "../../../../_core/sanity";
import {
  API_DEFAULT_LIMIT,
  API_MAX_LIMIT,
  API_MAX_OFFSET,
  API_VERSION,
  checkRateLimit,
  errorResponse,
  jsonResponse,
  optionsResponse,
  toPublicGame,
  type GameSummary,
} from "../../../../_core/public-api";
import { publicApiGamesQuery } from "../../../../_core/queries";

const SLUG_FILTER = /^[a-z0-9-]*$/;

function fail(): never {
  throw errorResponse(400, "invalid_request", "Invalid query parameters. See /openapi.json for accepted values.");
}

interface GamesQuery {
  q: string;
  genre: string;
  platform: string;
  theme: string;
  year?: number | undefined;
  limit: number;
  offset: number;
}

function slugFilterParam(value: string | null): string {
  const text = (value ?? "").trim();
  if (text.length > 60 || !SLUG_FILTER.test(text)) fail();
  return text;
}

function intParam(value: string | null, def: number, min: number, max: number): number {
  if (value === null) return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail();
  return n;
}

function optionalYear(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1970 || n > 2100) fail();
  return n;
}

function parseQuery(params: URLSearchParams): GamesQuery {
  const q = (params.get("q") ?? "").trim();
  if (q.length > 100) fail();
  const theme = (params.get("theme") ?? "").trim();
  if (theme.length > 60) fail();
  return {
    q,
    genre: slugFilterParam(params.get("genre")),
    platform: slugFilterParam(params.get("platform")),
    theme,
    year: optionalYear(params.get("year")),
    limit: intParam(params.get("limit"), API_DEFAULT_LIMIT, 1, API_MAX_LIMIT),
    offset: intParam(params.get("offset"), 0, 0, API_MAX_OFFSET),
  };
}

interface GamesResult {
  readonly total: number;
  readonly games: GameSummary[];
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  await initRequest(request, context);
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "GET") return errorResponse(405, "invalid_request", "Method not allowed.");

  const rate = checkRateLimit(request);
  if (rate.limited) return rate.limited;

  let query: GamesQuery;
  try {
    query = parseQuery(new URL(request.url).searchParams);
  } catch {
    return errorResponse(400, "invalid_request", "Invalid query parameters. See /openapi.json for accepted values.", rate.headers);
  }

  const term = query.q.replace(/[*"\\]/g, "");
  try {
    const result = await sanityFetch<GamesResult>(publicApiGamesQuery, {
      term: term.length > 0 ? `${term}*` : "",
      genre: query.genre,
      platform: query.platform,
      theme: query.theme,
      year: query.year ?? 0,
      offset: query.offset,
      end: query.offset + query.limit,
    });
    const games = result.games.map(toPublicGame).filter((game) => game !== null);
    const nextOffset = query.offset + query.limit < result.total ? query.offset + query.limit : null;
    return jsonResponse(
      { games, total: result.total, limit: query.limit, offset: query.offset, nextOffset, version: API_VERSION },
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

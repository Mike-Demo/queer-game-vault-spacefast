/**
 * GET /api/auth/username-available?username= — case-insensitive availability.
 * → { available: boolean }. Invalid shapes count as unavailable.
 */
import { apiError, json, withErrors } from "../../_core/http";
import { first } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "GET") return apiError(405, "invalid_request", "Method not allowed.");

  const username = (new URL(request.url).searchParams.get("username") ?? "").trim();
  if (!USERNAME_PATTERN.test(username)) return json({ available: false });
  const row = await first(env.db, "SELECT id FROM profiles WHERE LOWER(username) = LOWER(?)", username);
  return json({ available: row === null });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

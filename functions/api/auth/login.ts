/**
 * POST /api/auth/login — verify email + password, set the session cookie.
 * Body { email, password } → { ok: true, user: { id, email, username } }.
 * 401 `invalid_credentials` when the email is unknown or the password is wrong.
 */
import { apiError, InputError, json, withErrors } from "../../_core/http";
import { createSessionCookie, verifyPassword } from "../../_core/auth";
import { first } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = await first(env.db, "SELECT id, email, password_hash FROM users WHERE LOWER(email) = LOWER(?)", email);
  const ok = user !== null && (await verifyPassword(password, String(user["password_hash"])));
  if (!ok) return apiError(401, "invalid_credentials", "Invalid login credentials.");

  const profile = await first(env.db, "SELECT username FROM profiles WHERE id = ?", user["id"]);
  const username = profile && typeof profile["username"] === "string" ? profile["username"] : "";
  const cookie = await createSessionCookie(env, String(user["id"]));
  return json(
    { ok: true, user: { id: user["id"], email: user["email"], username } },
    200,
    { "Set-Cookie": cookie },
  );
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

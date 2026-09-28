/**
 * POST /api/auth/change-password — signed-in visitor sets a new password.
 * Body { password } (≥ 8 chars) → { ok: true }.
 */
import { apiError, InputError, json, withErrors } from "../../_core/http";
import { hashPassword, requireUser } from "../../_core/auth";
import { run } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  const userId = await requireUser(env, request);

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    throw new InputError("invalid_request", "Password must be at least 8 characters.");
  }

  await run(env.db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(password), userId);
  return json({ ok: true });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

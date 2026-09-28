/**
 * GET /api/auth/me — the signed-in visitor, or { user: null }.
 * → { user: { id, email, username, displayName, role } | null }, no-store.
 */
import { apiError, json, withErrors } from "../../_core/http";
import { verifySession } from "../../_core/auth";
import { first } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "GET") return apiError(405, "invalid_request", "Method not allowed.");

  const userId = await verifySession(env, request);
  if (!userId) return json({ user: null });

  const user = await first(env.db, "SELECT id, email FROM users WHERE id = ?", userId);
  if (!user) return json({ user: null });
  const profile = await first(env.db, "SELECT username, display_name FROM profiles WHERE id = ?", userId);
  const roleRow = await first(env.db, "SELECT role FROM user_roles WHERE user_id = ? LIMIT 1", userId);

  return json({
    user: {
      id: user["id"],
      email: user["email"],
      username: profile && typeof profile["username"] === "string" ? profile["username"] : "",
      displayName: profile && typeof profile["display_name"] === "string" ? profile["display_name"] : null,
      role: roleRow && typeof roleRow["role"] === "string" ? roleRow["role"] : null,
    },
  });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

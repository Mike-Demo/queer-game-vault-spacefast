/**
 * POST /api/auth/register — create a visitor account.
 * Body { username, email, password } → { ok: true, user: { id, email, username } }.
 * The first-ever registered user gets the `admin` role, everyone else `user`
 * (mirrors the original Supabase trigger).
 */
import { apiError, InputError, json, withErrors } from "../../_core/http";
import { createSessionCookie, hashPassword } from "../../_core/auth";
import { first, newId, run } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    throw new InputError("invalid_request", "Usernames use 3–24 letters, numbers or underscores.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new InputError("invalid_request", "Enter a valid email address.");
  }
  if (password.length < 8) {
    throw new InputError("invalid_request", "Password must be at least 8 characters.");
  }

  const takenName = await first(env.db, "SELECT id FROM profiles WHERE LOWER(username) = LOWER(?)", username);
  if (takenName) return apiError(409, "username_taken", "That username is already taken.");
  const takenEmail = await first(env.db, "SELECT id FROM users WHERE LOWER(email) = LOWER(?)", email);
  if (takenEmail) return apiError(409, "email_taken", "An account with that email already exists.");

  const userCount = await first(env.db, "SELECT COUNT(*) AS n FROM users");
  const isFirst = Number(userCount?.["n"] ?? 0) === 0;

  const id = newId();
  const now = Date.now();
  const passwordHash = await hashPassword(password);
  await run(env.db, "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)", id, email, passwordHash, now);
  await run(
    env.db,
    `INSERT INTO profiles (id, email, display_name, username, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    email,
    username,
    username,
    now,
    now,
  );
  await run(
    env.db,
    "INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
    newId(),
    id,
    isFirst ? "admin" : "user",
    now,
  );

  const cookie = await createSessionCookie(env, id);
  return json({ ok: true, user: { id, email, username } }, 200, { "Set-Cookie": cookie });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

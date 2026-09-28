/**
 * /api/profile/me — the signed-in visitor's own profile.
 * GET → MyProfile | null (joinedAt as ISO string).
 * PUT → UpdateProfileInput validation mirroring `updateMyProfile`;
 * username taken → 409 { ok:false, error:"That username is already taken." }.
 */
import { apiError, InputError, json, withErrors } from "../../_core/http";
import { requireUser } from "../../_core/auth";
import { first, run } from "../../_core/db";
import { initRequest, type RouteContext } from "../../_core/request";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim().slice(0, max);
  return next.length === 0 ? null : next;
}

interface UpdatePatch {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  profileVisibility?: "public" | "private";
  themePreference?: "light" | "dark" | "system";
  highContrast?: boolean;
}

function parsePatch(input: Record<string, unknown>): UpdatePatch {
  const patch: UpdatePatch = {};
  if (typeof input.username === "string") {
    const username = input.username.trim();
    if (!USERNAME_PATTERN.test(username)) {
      throw new InputError("invalid_request", "Usernames use 3–24 letters, numbers or underscores.");
    }
    patch.username = username;
  }
  if (input.displayName !== undefined) patch.displayName = trimmed(input.displayName, 60);
  if (input.bio !== undefined) patch.bio = trimmed(input.bio, 600);
  if (input.profileVisibility !== undefined) {
    if (input.profileVisibility !== "public" && input.profileVisibility !== "private") {
      throw new InputError("invalid_request", "Unknown profile visibility.");
    }
    patch.profileVisibility = input.profileVisibility;
  }
  if (input.themePreference !== undefined) {
    if (!["light", "dark", "system"].includes(input.themePreference as string)) {
      throw new InputError("invalid_request", "Unknown theme.");
    }
    patch.themePreference = input.themePreference as UpdatePatch["themePreference"];
  }
  if (input.highContrast !== undefined) patch.highContrast = Boolean(input.highContrast);
  return patch;
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env } = await initRequest(request, context);
  const userId = await requireUser(env, request);

  if (request.method === "GET") {
    const row = await first(
      env.db,
      `SELECT username, display_name, bio, avatar_url, created_at, email,
              profile_visibility, theme_preference, high_contrast
       FROM profiles WHERE id = ?`,
      userId,
    );
    if (!row) return json(null);
    return json({
      username: typeof row["username"] === "string" ? row["username"] : "",
      displayName: typeof row["display_name"] === "string" ? row["display_name"] : null,
      bio: typeof row["bio"] === "string" ? row["bio"] : null,
      avatarUrl: typeof row["avatar_url"] === "string" ? row["avatar_url"] : null,
      joinedAt: row["created_at"] === null ? null : new Date(Number(row["created_at"])).toISOString(),
      email: typeof row["email"] === "string" ? row["email"] : null,
      profileVisibility: row["profile_visibility"] === "private" ? "private" : "public",
      themePreference: ["light", "dark", "system"].includes(String(row["theme_preference"]))
        ? row["theme_preference"]
        : "system",
      highContrast: Number(row["high_contrast"]) === 1,
    });
  }

  if (request.method !== "PUT") return apiError(405, "invalid_request", "Method not allowed.");

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }
  const patch = parsePatch(input);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.username !== undefined) {
    const taken = await first(
      env.db,
      "SELECT id FROM profiles WHERE LOWER(username) = LOWER(?) AND id != ?",
      patch.username,
      userId,
    );
    if (taken) {
      return json({ ok: false, error: "That username is already taken." }, 409);
    }
    sets.push("username = ?");
    values.push(patch.username);
  }
  if (patch.displayName !== undefined) {
    sets.push("display_name = ?");
    values.push(patch.displayName);
  }
  if (patch.bio !== undefined) {
    sets.push("bio = ?");
    values.push(patch.bio);
  }
  if (patch.profileVisibility !== undefined) {
    sets.push("profile_visibility = ?");
    values.push(patch.profileVisibility);
  }
  if (patch.themePreference !== undefined) {
    sets.push("theme_preference = ?");
    values.push(patch.themePreference);
  }
  if (patch.highContrast !== undefined) {
    sets.push("high_contrast = ?");
    values.push(patch.highContrast ? 1 : 0);
  }

  if (sets.length === 0) return json({ ok: true, error: null });

  sets.push("updated_at = ?");
  values.push(Date.now());
  values.push(userId);
  try {
    await run(env.db, `UPDATE profiles SET ${sets.join(", ")} WHERE id = ?`, ...values);
  } catch {
    return json({ ok: false, error: "Your changes could not be saved. Please try again." });
  }
  return json({ ok: true, error: null });
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

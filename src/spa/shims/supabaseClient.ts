/**
 * Preview shim for `@/integrations/supabase/client`.
 *
 * Minimal stand-in for the Supabase JS auth client, backed by the SpaceFast
 * Functions session API (`/api/auth/*`). It implements the exact surface the
 * SPA pages use, with the real client's `{ data, error }` shapes:
 *
 * - `auth.getSession()` / `auth.getUser()`
 * - `auth.signInWithPassword({ email, password })`
 * - `auth.signUp({ email, password, options })`
 * - `auth.signOut()`
 * - `auth.updateUser({ password })`
 * - `auth.onAuthStateChange(callback)` → `{ data: { subscription } }`
 * - `rpc("username_available", { _username })`
 *
 * Auth state lives in the session cookie set by the Functions; there is no
 * Supabase project behind this preview.
 */

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "INITIAL_SESSION" | string;

interface PreviewSessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
}

interface PreviewSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    user_metadata: { username: string; display_name?: string | null };
  };
}

interface MeUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string | null;
}

interface MeResponse {
  user: MeUser | null;
}

type Listener = (event: AuthEvent, session: PreviewSession | null) => void;

const listeners = new Set<Listener>();
let cachedUser: PreviewSessionUser | null | undefined;

function toSession(user: PreviewSessionUser): PreviewSession {
  return {
    access_token: "preview",
    token_type: "bearer",
    expires_in: 60 * 60 * 24 * 7,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    refresh_token: "",
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { username: user.username, display_name: user.displayName },
    },
  };
}

function notify(event: AuthEvent, session: PreviewSession | null): void {
  for (const listener of listeners) {
    try {
      listener(event, session);
    } catch {
      /* a listener must never break auth state propagation */
    }
  }
}

async function readMe(): Promise<MeUser | null> {
  const res = await fetch("/api/auth/me", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Session check failed (HTTP ${res.status}).`);
  const body = (await res.json()) as MeResponse;
  return body.user ?? null;
}

async function currentUser(): Promise<PreviewSessionUser | null> {
  if (cachedUser !== undefined) return cachedUser;
  try {
    const user = await readMe();
    cachedUser = user
      ? { id: user.id, email: user.email, username: user.username, displayName: user.displayName }
      : null;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

function invalidateCache(): void {
  cachedUser = undefined;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (body && typeof body.error === "string" && body.error.length > 0) return body.error;
    if (body && typeof body.message === "string" && body.message.length > 0) return body.message;
  } catch {
    /* fall through to the fallback */
  }
  return fallback;
}

const auth = {
  async getSession(): Promise<{ data: { session: PreviewSession | null }; error: null }> {
    const user = await currentUser();
    return { data: { session: user ? toSession(user) : null }, error: null };
  },

  async getUser(): Promise<{
    data: { user: PreviewSession["user"] | null };
    error: Error | null;
  }> {
    try {
      const user = await currentUser();
      return {
        data: { user: user ? toSession(user).user : null },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: error instanceof Error ? error : new Error("Session check failed."),
      };
    }
  },

  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data: { user: PreviewSession["user"] | null; session: PreviewSession | null };
    error: Error | null;
  }> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    if (!res.ok) {
      const message = await readErrorMessage(res, "Sign in failed. Please try again.");
      return { data: { user: null, session: null }, error: new Error(message) };
    }
    const body = (await res.json()) as { user: PreviewSessionUser };
    invalidateCache();
    cachedUser = body.user;
    const session = toSession(body.user);
    notify("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  },

  async signUp(input: {
    email: string;
    password: string;
    options?: { data?: { username?: string } };
  }): Promise<{
    data: { user: PreviewSession["user"] | null; session: PreviewSession | null };
    error: Error | null;
  }> {
    const username = input.options?.data?.username ?? "";
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username, email: input.email, password: input.password }),
    });
    if (!res.ok) {
      const message = await readErrorMessage(res, "Registration failed. Please try again.");
      return { data: { user: null, session: null }, error: new Error(message) };
    }
    const body = (await res.json()) as { user: PreviewSessionUser };
    invalidateCache();
    cachedUser = body.user;
    const session = toSession(body.user);
    notify("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  },

  async signOut(): Promise<{ error: Error | null }> {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { accept: "application/json" } });
    } catch {
      /* the cookie clear is best-effort; still drop local state */
    }
    invalidateCache();
    notify("SIGNED_OUT", null);
    return { error: null };
  },

  async updateUser(attributes: { password?: string }): Promise<{
    data: { user: PreviewSession["user"] | null };
    error: Error | null;
  }> {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ password: attributes.password ?? "" }),
    });
    if (!res.ok) {
      const message = await readErrorMessage(res, "That password could not be changed.");
      return { data: { user: null }, error: new Error(message) };
    }
    const user = await currentUser();
    return { data: { user: user ? toSession(user).user : null }, error: null };
  },

  onAuthStateChange(callback: Listener): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    listeners.add(callback);
    const subscription = {
      unsubscribe: () => {
        listeners.delete(callback);
      },
    };
    return { data: { subscription } };
  },
};

async function rpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: Error | null }> {
  if (fn === "username_available") {
    const username = typeof args["_username"] === "string" ? args["_username"] : "";
    const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(username)}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      const message = await readErrorMessage(res, "That username could not be checked.");
      return { data: null, error: new Error(message) };
    }
    const body = (await res.json()) as { available?: unknown };
    return { data: body.available === true, error: null };
  }
  return { data: null, error: new Error(`Unknown function "${fn}".`) };
}

/** Drop-in replacement for the Supabase client import used by SPA pages. */
export const supabase = { auth, rpc };

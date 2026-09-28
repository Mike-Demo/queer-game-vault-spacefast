/**
 * Preview shim for `@/lib/tracking.functions`.
 *
 * Same names and call signatures as the original TanStack Start server
 * functions, backed by `fetch` against the SpaceFast Functions API:
 * `/api/library`, `/api/profile/me`, `/api/public/profile/:username`.
 */
import type { GameEntry, MyProfile, PublicProfile, TrackStatus } from "@/lib/tracking/types";

export interface SetStatusInput {
  igdbId: number;
  gameSlug: string;
  title: string;
  coverUrl?: string | null;
  /** null removes the game from the person's library. */
  status: TrackStatus | null;
}

export interface UpdateProfileInput {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  profileVisibility?: "public" | "private";
  themePreference?: "light" | "dark" | "system";
  highContrast?: boolean;
}

export interface PublicProfileResult {
  profile: PublicProfile | null;
  entries: GameEntry[];
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === "string" && body.error.length > 0) return body.error;
  } catch {
    /* fall through to the generic message */
  }
  return `That request failed (HTTP ${res.status}). Please try again.`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

/** Everything the signed-in person is tracking. */
export const listMyEntries = (): Promise<GameEntry[]> => get<GameEntry[]>("/api/library");

/** Add, move, or remove one game in the signed-in person's library. */
export const setGameStatus = ({
  data,
}: {
  data: SetStatusInput;
}): Promise<GameEntry | null> =>
  post<GameEntry | null>("/api/library", {
    igdbId: data.igdbId,
    gameSlug: data.gameSlug,
    title: data.title,
    coverUrl: data.coverUrl ?? null,
    status: data.status,
  });

/** The signed-in person's own profile, including private settings. */
export const getMyProfile = (): Promise<MyProfile | null> => get<MyProfile | null>("/api/profile/me");

/**
 * Save profile and preference changes for the signed-in person.
 * Preserves the original `{ ok, error }` shape — including the
 * `{ ok: false, error: "That username is already taken." }` 409 case.
 */
export const updateMyProfile = async ({
  data,
}: {
  data: UpdateProfileInput;
}): Promise<{ ok: boolean; error: string | null }> => {
  const res = await fetch("/api/profile/me", {
    method: "PUT",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(data),
  });
  let body: { ok?: unknown; error?: unknown } | null = null;
  try {
    body = (await res.json()) as { ok?: unknown; error?: unknown };
  } catch {
    body = null;
  }
  if (body && typeof body.ok === "boolean") {
    return { ok: body.ok, error: typeof body.error === "string" ? body.error : null };
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return { ok: true, error: null };
};

/** A public profile and its game lists. Private profiles resolve to null. */
export const getProfileByUsername = ({
  data,
}: {
  data: { username: string };
}): Promise<PublicProfileResult> =>
  get<PublicProfileResult>(`/api/public/profile/${encodeURIComponent(data.username)}`);

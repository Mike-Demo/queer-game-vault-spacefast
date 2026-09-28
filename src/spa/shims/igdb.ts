/**
 * Preview shim for `@/lib/igdb.functions`.
 *
 * The editorial IGDB pipeline (search, details, imports) needs production
 * Sanity/IGDB secrets and is intentionally unavailable in the SpaceFast
 * preview. Only `getMyEditorAccess` is backed by the Functions API.
 */

export interface IgdbSearchResult {
  igdbId: number;
  title: string;
  releaseYear: number | null;
  summary: string | null;
  coverUrl: string | null;
  genres: string[];
  platforms: string[];
  libraryStatus: string | null;
}

export interface IgdbSearchResponse {
  results: IgdbSearchResult[];
  hasMore: boolean;
  error: string | null;
}

export interface IgdbGameDetailsResponse {
  game: {
    igdbId: number;
    title: string;
    summary: string | null;
    storyline: string | null;
    coverUrl: string | null;
    screenshots: string[];
    firstReleaseDate: string | null;
    releaseYear: number | null;
    genres: string[];
    platforms: string[];
    themes: string[];
    gameModes: string[];
    developerName: string | null;
    publisherName: string | null;
    franchise: string | null;
    igdbCollectionName: string | null;
    ageRatings: { category: string; rating: string; descriptors: string[] }[];
    externalLinks: { label: string; url: string }[];
    igdbRating: number | null;
    igdbRatingCount: number | null;
    totalRating: number | null;
  } | null;
  existing: {
    _id: string;
    title: string;
    slug: string | null;
    editorialStatus: string;
    lastSyncedAt: string | null;
  } | null;
  error: string | null;
}

const UNAVAILABLE = "Editorial import is not available in the SpaceFast preview.";

/** Editor-only IGDB search. Credentials stay on the server. */
export const searchIgdbGames = (_input: {
  data: { term: string; offset?: number };
}): Promise<IgdbSearchResponse> => {
  throw new Error(UNAVAILABLE);
};

/** Editor-only full IGDB record for the preview panel. */
export const getIgdbGameDetails = (_input: {
  data: { igdbId: number };
}): Promise<IgdbGameDetailsResponse> => {
  throw new Error(UNAVAILABLE);
};

/** Whether the signed-in account may use the management screens. */
export const getMyEditorAccess = async (): Promise<{ role: string | null }> => {
  const res = await fetch("/api/auth/me", { headers: { accept: "application/json" } });
  if (!res.ok) return { role: null };
  const body = (await res.json()) as {
    user?: { role?: string | null } | null;
  };
  return { role: body.user?.role ?? null };
};

/**
 * SpaceFast preview: the editorial import pipeline (IGDB search, Sanity
 * writes, import-search/imports/review routes) is intentionally out of scope,
 * so editor nav links are hidden even for admins.
 */
export const EDITORIAL_AVAILABLE = false;

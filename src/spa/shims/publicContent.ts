/**
 * Preview shim for `@/lib/publicContent.functions`.
 *
 * Re-exports the same function names and call signatures as the original
 * TanStack Start server functions, but backed by `fetch` against the
 * SpaceFast Functions content API (`/api/content/*`) instead of direct
 * Sanity reads. Throws `Error` with the server's message on non-OK.
 */
import type {
  CollectionDetail,
  CollectionRef,
  CollectionSummary,
  ContentPage,
  GameDetail,
  GameSummary,
  SiteSettings,
  TaxonomyRef,
} from "@/lib/sanity/types";

export interface PublicDiscoverFacets {
  genres: TaxonomyRef[];
  platforms: TaxonomyRef[];
  themes: (string | null)[] | null;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === "string" && body.error.length > 0) return body.error;
  } catch {
    /* fall through to the generic message */
  }
  return `That content could not be loaded (HTTP ${res.status}). Please try again.`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export const fetchSiteSettings = (): Promise<SiteSettings | null> =>
  get<SiteSettings | null>("/api/content/site-settings");

export const fetchFeaturedGames = (): Promise<GameSummary[]> =>
  get<GameSummary[]>("/api/content/featured-games");

export const fetchLibraryGames = ({
  data,
}: {
  data: { offset: number; limit: number };
}): Promise<GameSummary[]> =>
  get<GameSummary[]>(`/api/content/library-games${query({ offset: data.offset, limit: data.limit })}`);

export const fetchFeaturedCollections = (): Promise<CollectionSummary[]> =>
  get<CollectionSummary[]>("/api/content/featured-collections");

export const fetchCollections = (): Promise<CollectionSummary[]> =>
  get<CollectionSummary[]>("/api/content/collections");

export const fetchCollection = ({ data }: { data: { slug: string } }): Promise<CollectionDetail | null> =>
  get<CollectionDetail | null>(`/api/content/collection${query({ slug: data.slug })}`);

export const fetchGame = ({ data }: { data: { slug: string } }): Promise<GameDetail | null> =>
  get<GameDetail | null>(`/api/content/game${query({ slug: data.slug })}`);

export const fetchGameCollections = ({
  data,
}: {
  data: { slug: string };
}): Promise<CollectionRef[]> =>
  get<CollectionRef[]>(`/api/content/game-collections${query({ slug: data.slug })}`);

export const fetchContentPage = ({ data }: { data: { slug: string } }): Promise<ContentPage | null> =>
  get<ContentPage | null>(`/api/content/content-page${query({ slug: data.slug })}`);

export const fetchRelatedGames = ({
  data,
}: {
  data: { id: string; genreIds: string[] };
}): Promise<GameSummary[]> =>
  get<GameSummary[]>(
    `/api/content/related-games${query({ id: data.id, genreIds: data.genreIds.join(",") })}`,
  );

export const fetchDiscoverFacets = (): Promise<PublicDiscoverFacets> =>
  get<PublicDiscoverFacets>("/api/content/discover-facets");

export const searchPublicGames = ({
  data,
}: {
  data: { term: string; genre: string; platform: string; theme: string };
}): Promise<GameSummary[]> =>
  get<GameSummary[]>(
    `/api/content/search-games${query({ term: data.term, genre: data.genre, platform: data.platform, theme: data.theme })}`,
  );

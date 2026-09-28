import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  breadcrumbs,
  DEFAULT_SHARE_IMAGE,
  jsonLdScript,
  organization,
  webPage,
  website,
} from "@/lib/seo/structuredData";

import { GameCard } from "@/components/GameCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews";
import {
  NesButton,
  NesField,
  NesInput,
  NesSelect,
  NesText,
} from "@/design-system/nes-229931";
import { Surface } from "@/components/Surface";
import {
  discoverFacetsQueryOptions,
  discoverSearchQueryOptions,
  type DiscoverFilters,
} from "@/lib/publicData";
import type { GameSummary } from "@/lib/sanity/types";

/** Characters whose names contain the search term, when the game's title doesn't. */
function matchedCharacters(game: GameSummary, term: string): string[] {
  const query = term.trim().toLowerCase();
  if (query.length === 0 || game.title.toLowerCase().includes(query)) return [];
  return game.lgbtqCharacterNames.filter(
    (name): name is string => name != null && name.toLowerCase().includes(query),
  );
}

interface DiscoverSearch {
  q?: string;
  genre?: string;
  platform?: string;
  theme?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 60) : undefined;
}

export const Route = createFileRoute("/discover")({
  staticData: { sitemap: true },
  validateSearch: (search: Record<string, unknown>): DiscoverSearch => ({
    q: readString(search["q"]),
    genre: readString(search["genre"]),
    platform: readString(search["platform"]),
    theme: readString(search["theme"]),
  }),
  head: () => ({
    meta: [
      { title: "Discover games — QueerCade" },
      {
        name: "description",
        content:
          "Search the QueerCade arcade by game title or LGBTQ+ character, and filter games by genre, platform and theme.",
      },
      { property: "og:title", content: "Discover games — QueerCade" },
      {
        property: "og:description",
        content: "Search every game in the QueerCade arcade by title or character.",
      },
      { property: "og:url", content: "https://queercade.mikedemo.dev/discover" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: DEFAULT_SHARE_IMAGE },
      { name: "twitter:image", content: DEFAULT_SHARE_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://queercade.mikedemo.dev/discover" }],
    scripts: [
      jsonLdScript(
        organization(),
        website(),
        webPage({
          type: "SearchResultsPage",
          path: "/discover",
          name: "Discover games — QueerCade",
          description: "Search every game in the QueerCade arcade by title or LGBTQ+ character.",
        }),
        breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Discover", path: "/discover" },
        ]),
      ),
    ],
  }),

  loader: ({ context }) => context.queryClient.ensureQueryData(discoverFacetsQueryOptions),
  errorComponent: () => (
    <AppShell>
      <ErrorState message="Discovery could not be loaded. Please refresh." />
    </AppShell>
  ),
  component: DiscoverPage,
});

function DiscoverPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const facets = useQuery(discoverFacetsQueryOptions);

  const [term, setTerm] = useState(search.q ?? "");

  // Debounce typing before it reaches the URL and the query.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = term.trim();
      if (next === (search.q ?? "")) return;
      void navigate({
        search: (previous: DiscoverSearch) => ({ ...previous, q: next.length > 0 ? next : undefined }),
        replace: true,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [term, navigate, search.q]);

  const filters: DiscoverFilters = {
    term: search.q ?? "",
    genre: search.genre ?? "",
    platform: search.platform ?? "",
    theme: search.theme ?? "",
  };

  const results = useQuery(discoverSearchQueryOptions(filters));
  const themes = (facets.data?.themes ?? []).filter((value): value is string => Boolean(value)).sort();
  const hasFilters =
    filters.term.length > 0 || filters.genre.length > 0 || filters.platform.length > 0 || filters.theme.length > 0;

  function setFilter(key: "genre" | "platform" | "theme", value: string) {
    void navigate({
      search: (previous: DiscoverSearch) => ({ ...previous, [key]: value.length > 0 ? value : undefined }),
      replace: true,
    });
  }

  return (
    <AppShell>
      <div className="stack-lg">
        <div className="row-between">
          <h1 className="title-xl">
            <NesText variant="primary">Discover games</NesText>
          </h1>
          <NesText className="text-xs">
            {results.data ? `${results.data.length} game${results.data.length === 1 ? "" : "s"}` : ""}
          </NesText>
        </div>

        <div className="discover-layout">
          <Surface title="Filters" rounded>
            <div className="stack">
              <NesField label="Search by game or character" htmlFor="discover-term">
                <NesInput
                  id="discover-term"
                  type="search"
                  value={term}
                  placeholder="Game or character"
                  onChange={(event) => setTerm(event.target.value)}
                />
              </NesField>

              <NesField label="Genre" htmlFor="discover-genre">
                <NesSelect
                  id="discover-genre"
                  value={filters.genre}
                  onChange={(event) => setFilter("genre", event.target.value)}
                >
                  <option value="">All genres</option>
                  {facets.data?.genres.map((genre) =>
                    genre.slug ? (
                      <option key={genre._id} value={genre.slug}>
                        {genre.name}
                      </option>
                    ) : null,
                  )}
                </NesSelect>
              </NesField>

              <NesField label="Platform" htmlFor="discover-platform">
                <NesSelect
                  id="discover-platform"
                  value={filters.platform}
                  onChange={(event) => setFilter("platform", event.target.value)}
                >
                  <option value="">All platforms</option>
                  {facets.data?.platforms.map((platform) =>
                    platform.slug ? (
                      <option key={platform._id} value={platform.slug}>
                        {platform.name}
                      </option>
                    ) : null,
                  )}
                </NesSelect>
              </NesField>

              <NesField label="Theme" htmlFor="discover-theme">
                <NesSelect
                  id="discover-theme"
                  value={filters.theme}
                  onChange={(event) => setFilter("theme", event.target.value)}
                >
                  <option value="">All themes</option>
                  {themes.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </NesSelect>
              </NesField>

              {hasFilters ? (
                <NesButton
                  type="button"
                  onClick={() => {
                    setTerm("");
                    void navigate({ search: {}, replace: true });
                  }}
                >
                  Clear filters
                </NesButton>
              ) : null}
            </div>
          </Surface>

          <div className="stack">
            {results.isPending ? <LoadingState label="Searching games" /> : null}
            {results.isError ? <ErrorState message="Those results could not be loaded." /> : null}
            {results.data && results.data.length === 0 ? (
              <EmptyState title="No games match those filters">
                <NesText>Try a shorter title, or clear a filter.</NesText>
              </EmptyState>
            ) : null}
            {results.data && results.data.length > 0 ? (
              <div className="card-grid" aria-busy={results.isFetching}>
                {results.data.map((game) => {
                  const characters = matchedCharacters(game, filters.term);
                  return (
                    <div key={game._id} className="stack">
                      <GameCard game={game} />
                      {characters.length > 0 ? (
                        <NesText className="text-xs">
                          Character: {characters.join(", ")}
                        </NesText>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

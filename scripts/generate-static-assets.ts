/**
 * Generates static SEO/AEO assets into the SPA dist folder at publish time:
 * - sitemap.xml (static paths + Sanity game/collection slugs)
 * - openapi.json (from the shared OPENAPI_DOCUMENT)
 * - llms-full.txt (from buildLlmsTxt + the game catalog)
 * - .well-known/agent.json (agent identity document)
 *
 * Usage: bun scripts/generate-static-assets.ts <dist-dir>
 * Site URLs stay pointed at production (queercade.mikedemo.dev) so the
 * preview never presents itself as canonical.
 */
import { API_BASE_PATH, API_MAX_LIMIT, API_VERSION, OPENAPI_DOCUMENT, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "@/lib/publicApi";
import { SITE_URL } from "@/lib/seo/structuredData";
import { buildLlmsTxt } from "@/lib/llmsTxt";

const PROJECT_ID = "tzh8tziu";
const DATASET = "production";
const API_VERSION_SANITY = "2024-10-01";

const STATIC_PATHS = [
  "/",
  "/library",
  "/collections",
  "/discover",
  "/about",
  "/licenses",
  "/developers",
  "/emoji",
];

async function fetchSlugs(query: string): Promise<{ slug: string; lastmod?: string | null }[]> {
  const url = `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION_SANITY}/data/query/${DATASET}?query=${encodeURIComponent(query)}&perspective=published`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sanity slug query failed: ${response.status}`);
  const body = (await response.json()) as { result?: { slug?: string | null; lastmod?: string | null }[] };
  return (body.result ?? [])
    .filter((row) => row.slug)
    .map((row) => ({ slug: row.slug as string, lastmod: row.lastmod ?? null }));
}

const GAME_SLUGS = `*[_type == "game" && editorialStatus in ["approved", "featured"] && defined(slug.current)]{ "slug": slug.current, "lastmod": _updatedAt } | order(slug.current asc)`;
const COLLECTION_SLUGS = `*[_type == "gameCollection" && status == "published" && defined(slug.current)]{ "slug": slug.current, "lastmod": _updatedAt } | order(slug.current asc)`;
const LLMS_GAMES = `*[_type == "game" && editorialStatus in ["approved", "featured"] && defined(slug.current)] | order(title asc){ "slug": slug.current, title, releaseYear }`;
const LLMS_COLLECTIONS = `*[_type == "gameCollection" && status == "published" && defined(slug.current)] | order(title asc){ "slug": slug.current, title, description }`;

function sitemapXml(entries: { path: string; lastmod?: string | null }[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url><loc>${SITE_URL}${entry.path}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function agentJson(): Record<string, unknown> {
  return {
    name: "QueerCade",
    description:
      "A curated catalog of video games with LGBTQ+ characters and stories. Read-only search and lookup of games and collections.",
    url: SITE_URL,
    version: API_VERSION,
    documentationUrl: `${SITE_URL}/developers`,
    llmsTxt: `${SITE_URL}/llms.txt`,
    api: {
      type: "openapi",
      url: `${SITE_URL}/openapi.json`,
      baseUrl: `${SITE_URL}${API_BASE_PATH}`,
      readOnly: true,
      maxPageSize: API_MAX_LIMIT,
    },
    mcp: {
      type: "http",
      url: `${SITE_URL}/api/public/mcp`,
      protocolVersion: "2025-06-18",
      tools: ["search_games", "get_game", "list_collections", "get_collection", "list_facets"],
    },
    authentication: { type: "none" },
    rateLimit: {
      requests: RATE_LIMIT_MAX,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      retryAfterHeader: true,
      note: "Best effort per server instance. Cache responses instead of re-polling.",
    },
    errors: {
      shape: "{ error: { code, message, status } }",
      codes: ["invalid_request", "not_found", "rate_limited", "service_unavailable"],
    },
    capabilities: ["search_games", "get_game", "list_collections", "get_collection", "list_facets"],
    provider: { organization: "MikeDemo", url: SITE_URL },
  };
}

const dist = process.argv[2];
if (!dist) throw new Error("Usage: bun scripts/generate-static-assets.ts <dist-dir>");

const [games, collections] = await Promise.all([fetchSlugs(GAME_SLUGS), fetchSlugs(COLLECTION_SLUGS)]);

const entries = [
  ...STATIC_PATHS.map((path) => ({ path })),
  ...collections.map((row) => ({ path: `/collections/${row.slug}`, lastmod: row.lastmod })),
  ...games.map((row) => ({ path: `/games/${row.slug}`, lastmod: row.lastmod })),
];

await Bun.write(`${dist}/sitemap.xml`, sitemapXml(entries));
await Bun.write(`${dist}/openapi.json`, JSON.stringify(OPENAPI_DOCUMENT, null, 2));
await Bun.write(`${dist}/.well-known/agent.json`, JSON.stringify(agentJson(), null, 2));

const llmsGames = (await fetchSlugs(LLMS_GAMES)) as { slug: string; title?: string; releaseYear?: number | null }[];
const llmsCollections = (await fetchSlugs(LLMS_COLLECTIONS)) as { slug: string; title?: string; description?: string | null }[];
const full =
  [
    buildLlmsTxt().trimEnd(),
    "",
    "## Collections",
    "",
    ...llmsCollections.map(
      (c) => `- [${c.title ?? c.slug}](${SITE_URL}/collections/${c.slug})${c.description ? `: ${String(c.description).replace(/\s+/g, " ")}` : ""}`,
    ),
    "",
    "## Games",
    "",
    ...llmsGames.map(
      (g) => `- [${g.title ?? g.slug}](${SITE_URL}/games/${g.slug})${g.releaseYear ? ` (${g.releaseYear})` : ""}`,
    ),
    "",
  ].join("\n");
await Bun.write(`${dist}/llms-full.txt`, full);

console.log(`static assets: ${entries.length} sitemap urls, openapi.json, agent.json, llms-full.txt`);

# QueerCade SpaceFast preview — build contract

Target: isolated preview space `queercade-preview` (https://queercade-preview.view.fast/).
Nothing here may touch Lovable production, the original repo's `main`, or any
production domain/DNS. Work only in this fork on branch `spacefast-migration`.

## Layout

```
functions/_core/{http,db,request,auth,sanity}.ts   (done — do not rewrite)
functions/api/**                                    (SpaceFast Functions)
src/spa/**                                          (standalone SPA)
spa.html, vite.spa.config.ts                        (SPA entry + build)
public/**                                           (copied as-is into dist)
scripts/generate-static-assets.ts                   (done — sitemap.xml, openapi.json, agent.json, llms-full.txt)
scripts/publish-spacefast.sh                        (done — builds + publishes)
sf.jsonc                                            (done)
```

SpaceFast Functions routing: `functions/api/content/game.ts` serves
`GET /api/content/game`; `functions/api/public/v1/games/[slug].ts` serves
`GET /api/public/v1/games/:slug`. Each file exports one const per HTTP method
(`export const GET = handle;` etc., where
`handle = withErrors(async (request: Request, context: RouteContext) => ...)`)
— the runtime calls the export matching the request method. Use
`initRequest(request, context)` from `_core/request.ts` to get `{ env, ip }`.
`env.db` is the D1 binding (already schema-ensured). Wrap handlers with
`withErrors` from `_core/http.ts`.

SELF-CONTAINMENT RULE: the publish script ships only `functions/` + `sf.jsonc`,
so Functions must not import from `src/`. Vendor the pure modules you need
into `functions/_core/` as self-contained ports:
- `functions/_core/queries.ts` — the GROQ query string constants from
  `src/lib/sanity/queries.ts` (pure strings; copy them verbatim).
- `functions/_core/public-api.ts` — port of the pieces needed from
  `src/lib/publicApi.ts`: `API_*` constants, CORS headers, `jsonResponse`,
  `errorResponse`, `optionsResponse`, `checkRateLimit`, `toPublicGame`,
  `toPublicGameDetail`, `toPublicCollection`, `OPENAPI_DOCUMENT`.
  Reimplement `coverUrl` locally: if `game.cover?.asset?._ref` (form
  `image-<id>-<WxH>-<format>`), return
  `https://cdn.sanity.io/images/tzh8tziu/production/<id>-<width>x<height>.<format>`
  with height = round(width * 1.33); else `game.sourceCoverUrl ?? null`.
  (This matches `@sanity/image-url` with `.width(w).height(h).fit("crop").quality(75).auto("format")`
  closely enough for the preview.)
- `functions/_core/oracle.ts` — port of the oracle pieces from
  `src/lib/emojiOracle/oracle.server.ts`: `EMOJI_MEANINGS` (from
  `src/lib/emojiOracle/emojis.ts`), `SYSTEM_PROMPT`, `BLOCKED_TERMS`,
  the `query_catalog` tool guards, and `parseAnswer`. Replace the Sanity MCP
  with `sanityFetch` + the same guards. Replace the Lovable gateway client with
  a dependency-free OpenAI chat-completions tool loop (`fetch` against
  `https://api.openai.com/v1/chat/completions`, model `gpt-4o-mini`, up to 50
  tool steps — no npm imports anywhere in `functions/`). Keep the tool
  name/shape (`query_catalog` with a `groq` string argument).
  Keep every status code, error code string, header name and JSON shape
  identical to the originals — the mikedemo.dev pixel heart calls
  `/api/public/v1/appreciations/:slug` in production, so the contract must not drift.

IMPORTANT — SpaceFast D1 is MySQL-flavored: use `?` placeholders, `VARCHAR`,
`TINYINT`, `BIGINT`. Booleans bind via `toDbValue` (done in `q()`).

## Functions API contract

### Content (Sanity-backed, public). GROQ queries are vendored in
`functions/_core/queries.ts` (copied verbatim from
`src/lib/sanity/queries.ts`). Use `sanityFetch` from `_core/sanity.ts`.

- `GET /api/content/site-settings` → SiteSettings | null (`siteSettingsQuery`)
- `GET /api/content/featured-games` → GameSummary[] (`featuredGamesQuery`, limit 6)
- `GET /api/content/library-games?offset=0&limit=60` → GameSummary[] (`approvedGamesQuery`; clamp limit 1..120, offset 0..10000)
- `GET /api/content/featured-collections` → CollectionSummary[] (`featuredCollectionsQuery`, limit 4)
- `GET /api/content/collections` → CollectionSummary[] (`publishedCollectionsQuery`)
- `GET /api/content/collection?slug=` → CollectionDetail | null (`collectionBySlugQuery`)
- `GET /api/content/game?slug=` → GameDetail | null (`gameBySlugQuery`)
- `GET /api/content/game-collections?slug=` → CollectionRef[] (`gameCollectionsBySlugQuery`)
- `GET /api/content/content-page?slug=` → ContentPage | null (`contentPageBySlugQuery`)
- `GET /api/content/related-games?id=&genreIds=a,b,c` → GameSummary[] (`relatedGamesQuery`, limit 3; empty array when no genreIds)
- `GET /api/content/discover-facets` → { genres, platforms, themes } (`discoverFacetsQuery`)
- `GET /api/content/search-games?term=&genre=&platform=&theme=` → GameSummary[] (`searchGamesQuery`, limit 48; term → `${term}*` when non-empty)

All: `Cache-Control: public, max-age=60` on 200. 400 on invalid input.

### Public API v1 — exact contract from `src/lib/publicApi.ts`
(ported to `functions/_core/public-api.ts` per the self-containment rule).

- `GET /api/public/v1/games` — query: q, genre, platform, theme, year, limit
  (1..48, default 24), offset (0..10000, default 0). Uses `publicApiGamesQuery`
  from sanity queries. Response `{ games, total, limit, offset, nextOffset, version }`.
  CORS `*`, `X-Api-Version`, cache 5min/1h. 400 invalid_request, 429 rate_limited,
  503 service_unavailable. Rate limit via `checkRateLimit`.
- `GET /api/public/v1/games/[slug]` — `toPublicGameDetail`; 404 when missing.
- `GET /api/public/v1/collections` — `{ collections, total, version }`.
- `GET /api/public/v1/collections/[slug]` — `{ ...toPublicCollection, games }`; 404 when missing.
- `GET /api/public/v1/facets` — `{ genres: [{name, slug}], platforms: [{name, slug}], themes: string[] }`.
- `GET /api/public/v1/appreciations/[slug]` → `{ slug, total }` (D1 `game_appreciations`; missing → total 0).
- `POST /api/public/v1/appreciations/[slug]` → atomic increment, `{ slug, total }`
  (`INSERT ... ON DUPLICATE KEY UPDATE total = total + 1` then select).
- `OPTIONS` on each → `optionsResponse()`.

Keep every status code, error code string, header name and JSON shape
identical to the originals — the mikedemo.dev pixel heart calls
`/api/public/v1/appreciations/:slug` in production, so the contract must not drift.

### MCP — `src/routes/api/public/mcp.ts` is fully portable
Port it 1:1 to `functions/api/public/mcp.ts`: same TOOLS list, same
`initialize`/`ping`/`tools/list`/`tools/call` handling, same CORS headers,
same `PROTOCOL_VERSION = "2025-06-18"`, same rate limiting. Replace
`sanityPublicClient.fetch` with `sanityFetch`, `toPublic*` from the vendored
`_core/public-api.ts`.

### Auth (D1 users + session cookie)
- `POST /api/auth/register` `{ username, email, password }` → validates
  username `/^[A-Za-z0-9_]{3,24}$/`, availability (case-insensitive), email
  shape, password ≥ 8. Creates `users` + `profiles` rows (username from input,
  display_name = username). First-ever registered user gets `admin` role,
  others get `user` (mirrors the original trigger). Sets session cookie.
  → `{ ok: true, user: { id, email, username } }`. 409 `username_taken` /
  `email_taken`.
- `POST /api/auth/login` `{ email, password }` → verifies PBKDF2 hash, sets
  cookie → `{ ok: true, user }`. 401 `invalid_credentials`.
- `POST /api/auth/logout` → clears cookie → `{ ok: true }`.
- `GET /api/auth/me` → `{ user: { id, email, username, displayName, role } | null }`
  (role from `user_roles`; null when signed out). no-store.
- `GET /api/auth/username-available?username=` → `{ available: boolean }`.
- `POST /api/auth/change-password` (auth) `{ password }` (≥ 8) → `{ ok: true }`.

Password hashing: `hashPassword`/`verifyPassword` in `_core/auth.ts`.
Sessions: `createSessionCookie`/`requireUser` in `_core/auth.ts`.

### Library / profile / picks (session required)
Mirror `src/lib/tracking.functions.ts` shapes exactly:
- `GET /api/library` → GameEntry[] (`{ igdbId, gameSlug, title, coverUrl, status, updatedAt }`)
  ordered by updated_at desc.
- `POST /api/library` `{ igdbId, gameSlug, title, coverUrl?, status | null }`
  → upsert on (user_id, igdb_id), or delete when status null → GameEntry | null.
  Same validation messages as the original.
- `GET /api/profile/me` → MyProfile (`{ username, displayName, bio, avatarUrl,
  joinedAt, email, profileVisibility, themePreference, highContrast }`) | null.
  `joinedAt`/`updatedAt` are epoch ms numbers in D1 — return ISO strings.
- `PUT /api/profile/me` — same `UpdateProfileInput` validation as
  `updateMyProfile`; username change → 409 `{ ok:false, error:"That username is already taken." }`;
  → `{ ok, error }`.
- `GET /api/public/profile/[username]` → `{ profile, entries }`; private or
  missing → `{ profile: null, entries: [] }`. Mirrors `getProfileByUsername`.

### Emoji oracle
- `POST /api/oracle` `{ emojis: string[] }` — same validation as the original
  (`EMOJI_MEANINGS` from `src/lib/emojiOracle/emojis.ts`, 3..5 unique emojis),
  same IP rate limit (6/min). Uses OpenAI (`OPENAI_API_KEY` env) via the
  `ai` SDK `streamText` + `query_catalog` tool backed by `sanityFetch` with the
  original guards (BLOCKED_TERMS + editorialStatus filter required). Same
  `OracleResponse` shape. Without `OPENAI_API_KEY` → `{ ok:false, message:"The oracle is not configured." }`.
  System prompt + constants: copy from `src/lib/emojiOracle/oracle.server.ts`.
- `GET /api/emoji-picks` (auth) → EmojiPick[] (latest 20).
- `POST /api/emoji-picks` (auth) same `saveInput` validation → `{ ok: true }`.

## SPA contract (`src/spa/`)

Build a standalone Vite SPA (`spa.html` → `src/spa/main.tsx`) that reuses the
existing TanStack Router page components. Approach:

1. `vite.spa.config.ts` (at repo root): aliases
   - `"@": <root>/src`
   - `"@/lib/publicContent.functions"` → `src/spa/shims/publicContent.ts`
   - `"@/lib/tracking.functions"` → `src/spa/shims/tracking.ts`
   - `"@/lib/emojiOracle.functions"` → `src/spa/shims/emojiOracle.ts`
   - `"@/lib/igdb.functions"` → `src/spa/shims/igdb.ts`
   - `"@/lib/editorial.functions"` → `src/spa/shims/editorial.ts`
   - `"@/integrations/supabase/client"` → `src/spa/shims/supabaseClient.ts`
   - `"@/integrations/lovable"` → `src/spa/shims/lovable.ts`
   Alias order matters: exact module aliases must win over the `@/*` prefix.
   Entry: `spa.html` → `/src/spa/main.tsx`, outDir `dist-spa`.
   Do NOT include `@tanstack/react-start` plugins. Exclude server-only files
   from the bundle (nothing under `src/routes/api/`, `*.server.ts` should be
   reachable — the shims cut those imports).

2. Each shim re-exports the same names with the same call signatures, backed
   by `fetch` against the Functions above:
   - `publicContent.ts`: `fetchSiteSettings()`, `fetchFeaturedGames()`,
     `fetchLibraryGames({data:{offset,limit}})`, `fetchFeaturedCollections()`,
     `fetchCollections()`, `fetchCollection({data:{slug}})`,
     `fetchGame({data:{slug}})`, `fetchGameCollections({data:{slug}})`,
     `fetchContentPage({data:{slug}})`, `fetchRelatedGames({data:{id,genreIds}})`,
     `fetchDiscoverFacets()`, `searchPublicGames({data:{term,genre,platform,theme}})`.
     NOTE: original server fns are called as `fetchGame({ data: { slug } })`.
     Keep that signature. Throw `Error` with the message on non-OK.
   - `tracking.ts`: `listMyEntries()`, `setGameStatus(input: SetStatusInput)`,
     `getMyProfile()`, `updateMyProfile(input: UpdateProfileInput)`,
     `getProfileByUsername({username})`, plus the `SetStatusInput` /
     `UpdateProfileInput` types.
   - `emojiOracle.ts`: `askEmojiOracle({emojis})`, `saveEmojiPick(input)`,
     `listEmojiPicks()`, type `OracleResponse`.
   - `igdb.ts`: `getMyEditorAccess()` → `{ role: string | null }` from
     `/api/auth/me`. `searchIgdbGames`/`getIgdbGameDetails` → throw
     `new Error("Editorial import is not available in the SpaceFast preview.")`.
   - `editorial.ts`: `getImportHistory`, `importGamesFromIgdb`, and any other
     exports the editor routes import → throw the same "not available" error.
     (Check `src/routes/_authenticated/*.tsx` imports to cover every name.)
   - `supabaseClient.ts`: a minimal `supabase` object supporting what the SPA
     pages use: `auth.getSession()`, `auth.getUser()`, `auth.signInWithPassword`,
     `auth.signUp`, `auth.signOut`, `auth.updateUser({password})`,
     `auth.onAuthStateChange`, `rpc("username_available", ...)`.
     Backed by the `/api/auth/*` endpoints + a tiny in-memory listener set.
     `signUp` should POST to `/api/auth/register` and surface
     `{ error }`-shaped results like the real client.
   - `lovable.ts`: `lovable.auth.signInWithOAuth` → return
     `{ redirected: false, error: new Error("Google sign-in is not available in the SpaceFast preview.") }`.
     Check `src/integrations/lovable/index.ts` for the exact surface used.

3. `src/spa/router.tsx`: build the router from the existing file routes,
   reparented under a new SPA root route:
   ```tsx
   import { createRootRoute, createRouter } from "@tanstack/react-router";
   import { Route as IndexRoute } from "@/routes/index";
   // ... etc for every page route
   const rootRoute = createRootRoute({ component: SpaRoot });
   const routeTree = rootRoute.addChildren([
     IndexRoute.update({ getParentRoute: () => rootRoute } as any),
     ...
   ]);
   ```
   Verify `.update()` reparenting works with the installed
   `@tanstack/react-router` version; fall back to `createRoute` spread if not.
   INCLUDE page routes: `/`, `/library`, `/collections`, `/collections/$slug`,
   `/games/$slug`, `/discover`, `/about`, `/licenses`, `/developers`, `/emoji`,
   `/auth`, `/my-library` (via `_authenticated` route), `/settings`,
   `/profile/$username`.
   EXCLUDE: `/api/**`, `/__mockup`, `/__component` preview routes,
   `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/.well-known/agent.json`,
   `/sitemap.xml` (static files now), and the editor routes
   `/_authenticated/import-search`, `/_authenticated/imports`,
   `/_authenticated/review` (editorial import needs production Sanity/IGDB
   secrets — intentionally out of the preview).
   The `_authenticated` route's `beforeLoad` calls `supabase.auth.getUser()` —
   the shim makes this work unchanged.

4. `src/spa/Root.tsx`: providers from the original `__root.tsx` minus SSR:
   `QueryClientProvider`, `NesProvider`, `ThemeProvider` (init from
   `readAppearance()`), `Outlet`. Plus a `HeadManager` component that reads the
   deepest matched route's `options.head`, calls it with
   `{ loaderData, params, search }`, and applies `meta` (title/description/og),
   `links` (canonical) and `scripts` (JSON-LD) to `document.head` on
   navigation. Use `useMatches()` from `@tanstack/react-router`.

5. `src/spa/auth-page.tsx`: replace `/auth` route's component? No — reuse the
   original `auth.tsx` route object but its Google button will show the
   "not available" error via the lovable shim, and email flows go through the
   supabase shim. That works unchanged. (Keep the original route.)

6. `spa.html`: full document with the same head meta as the original root
   (title "QueerCade", description, og tags, favicon, font preload,
   umami tracker script `https://umami-lite.view.fast/tracker.js`
   data-website-id `d6f0c101-7e14-4719-8a37-510d659b3ff9`), `<div id="root">`,
   `<script type="module" src="/src/spa/main.tsx">`, and
   `<meta name="robots" content="noindex, nofollow">` (preview must not be indexed).

7. `src/spa/main.tsx`: `createRoot` render with `StrictMode`, import the app
   CSS (`@/styles.css`).

Also copy `public/_headers` handling if needed — check its content; the
`_redirects` in the publish script covers SPA fallback. The umami tracker and
CSP: keep the CSP meta from the original root in spa.html.

## Deferred (do NOT build)
- Editor import pipeline (import-search/review/imports routes, IGDB search,
  Sanity writes) — needs production secrets.
- Google OAuth — replaced by email/password in the preview.
- Cron jobs — none in this app.

## Verification checklist
- `bun x vite build --config vite.spa.config.ts` succeeds; `tsc` clean for new code.
- Homepage, a game page, collections, discover, library render from Sanity.
- `/api/public/v1/games?limit=2`, `/games/<slug>`, `/collections`, `/facets`,
  `/openapi.json`, `/.well-known/agent.json`, `/llms.txt`, `/llms-full.txt`,
  `/sitemap.xml`, `/carbon.txt`, `/robots.txt` all 200.
- MCP `tools/list` + `search_games` call work.
- Appreciations GET → 0, POST → 1, GET → 1.
- Register → login → my-library add/remove → settings save → public profile page.
- Oracle without key → "not configured" message (do not set a real key).
- No secret is printed, committed, or copied from production.

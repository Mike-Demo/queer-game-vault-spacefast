import { createRouter } from "@tanstack/react-router";

import { Route as AboutRouteImport } from "@/routes/about";
import { Route as AuthRouteImport } from "@/routes/auth";
import { Route as AuthenticatedRouteImport } from "@/routes/_authenticated/route";
import { Route as AuthenticatedMyLibraryRouteImport } from "@/routes/_authenticated/my-library";
import { Route as AuthenticatedSettingsRouteImport } from "@/routes/_authenticated/settings";
import { Route as CollectionsIndexRouteImport } from "@/routes/collections.index";
import { Route as CollectionsSlugRouteImport } from "@/routes/collections.$slug";
import { Route as DevelopersRouteImport } from "@/routes/developers";
import { Route as DiscoverRouteImport } from "@/routes/discover";
import { Route as EmojiRouteImport } from "@/routes/emoji";
import { Route as GamesSlugRouteImport } from "@/routes/games.$slug";
import { Route as IndexRouteImport } from "@/routes/index";
import { Route as LibraryRouteImport } from "@/routes/library";
import { Route as LicensesRouteImport } from "@/routes/licenses";
import { Route as ProfileUsernameRouteImport } from "@/routes/profile.$username";

import { queryClient, rootRoute } from "./Root";

/**
 * Standalone SPA route tree.
 *
 * Reuses the existing TanStack Router file routes unchanged, reparented under
 * the SPA root route via `.update({ getParentRoute })` (the same mechanism the
 * generated route tree uses). Component, loader, head, beforeLoad,
 * validateSearch, and errorComponent options are preserved as-is.
 *
 * Included: /, /library, /collections, /collections/$slug, /games/$slug,
 * /discover, /about, /licenses, /developers, /emoji, /auth, /my-library,
 * /settings, /profile/$username.
 *
 * Excluded: /api/**, /__mockup and /__component previews, the static text
 * routes (/llms.txt, /llms-full.txt, /openapi.json, /.well-known/agent.json,
 * /sitemap.xml — shipped as static files), and the editor routes
 * (/import-search, /imports, /review).
 */

type AnyRoute = { update: (options: Record<string, unknown>) => any };

function reparent(route: AnyRoute, id: string, path?: string): any {
  return route.update({
    id,
    ...(path === undefined ? {} : { path }),
    getParentRoute: () => rootRoute,
  });
}

const indexRoute = reparent(IndexRouteImport as unknown as AnyRoute, "/", "/");
const libraryRoute = reparent(LibraryRouteImport as unknown as AnyRoute, "/library", "/library");
const collectionsIndexRoute = reparent(
  CollectionsIndexRouteImport as unknown as AnyRoute,
  "/collections/",
  "/collections/",
);
const collectionsSlugRoute = reparent(
  CollectionsSlugRouteImport as unknown as AnyRoute,
  "/collections/$slug",
  "/collections/$slug",
);
const gamesSlugRoute = reparent(
  GamesSlugRouteImport as unknown as AnyRoute,
  "/games/$slug",
  "/games/$slug",
);
const discoverRoute = reparent(DiscoverRouteImport as unknown as AnyRoute, "/discover", "/discover");
const aboutRoute = reparent(AboutRouteImport as unknown as AnyRoute, "/about", "/about");
const licensesRoute = reparent(LicensesRouteImport as unknown as AnyRoute, "/licenses", "/licenses");
const developersRoute = reparent(
  DevelopersRouteImport as unknown as AnyRoute,
  "/developers",
  "/developers",
);
const emojiRoute = reparent(EmojiRouteImport as unknown as AnyRoute, "/emoji", "/emoji");
const authRoute = reparent(AuthRouteImport as unknown as AnyRoute, "/auth", "/auth");
const profileUsernameRoute = reparent(
  ProfileUsernameRouteImport as unknown as AnyRoute,
  "/profile/$username",
  "/profile/$username",
);

const authenticatedRoute = reparent(AuthenticatedRouteImport as unknown as AnyRoute, "/_authenticated");

const myLibraryRoute = (AuthenticatedMyLibraryRouteImport as unknown as AnyRoute).update({
  id: "/my-library",
  path: "/my-library",
  getParentRoute: () => authenticatedRoute,
});

const settingsRoute = (AuthenticatedSettingsRouteImport as unknown as AnyRoute).update({
  id: "/settings",
  path: "/settings",
  getParentRoute: () => authenticatedRoute,
});

const authenticatedRouteWithChildren = authenticatedRoute.addChildren([myLibraryRoute, settingsRoute]);

const routeTree = rootRoute.addChildren([
  indexRoute,
  libraryRoute,
  collectionsIndexRoute,
  collectionsSlugRoute,
  gamesSlugRoute,
  discoverRoute,
  aboutRoute,
  licensesRoute,
  developersRoute,
  emojiRoute,
  authRoute,
  profileUsernameRoute,
  authenticatedRouteWithChildren,
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

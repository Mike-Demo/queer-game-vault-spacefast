import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useMatches, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { ThemeProvider } from "@/components/ThemeProvider";
import { NesProvider } from "@/design-system/nes-229931";
import { supabase } from "@/integrations/supabase/client";
import { readAppearance } from "@/lib/theme/mode";

const MANAGED_ATTR = "data-spa-head";

interface HeadMetaEntry {
  title?: string;
  charSet?: string;
  name?: string;
  property?: string;
  httpEquiv?: string;
  content?: string;
}

interface HeadLinkEntry {
  rel?: string;
  href?: string;
  [key: string]: unknown;
}

interface HeadScriptEntry {
  type?: string;
  children?: string;
  src?: string;
  [key: string]: unknown;
}

interface HeadResult {
  meta?: HeadMetaEntry[];
  links?: HeadLinkEntry[];
  scripts?: HeadScriptEntry[];
}

/** Clear everything a previous route's head() call managed. */
function clearManagedHead(): void {
  document.head.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((node) => node.remove());
}

function applyMeta(meta: HeadMetaEntry[]): void {
  for (const entry of meta) {
    if (typeof entry.title === "string") {
      document.title = entry.title;
      continue;
    }
    if (entry.charSet) continue; // static in spa.html
    const tag = document.createElement("meta");
    tag.setAttribute(MANAGED_ATTR, "");
    if (entry.name) tag.setAttribute("name", entry.name);
    if (entry.property) tag.setAttribute("property", entry.property);
    if (entry.httpEquiv) tag.setAttribute("http-equiv", entry.httpEquiv);
    if (typeof entry.content === "string") tag.setAttribute("content", entry.content);
    document.head.appendChild(tag);
  }
}

function applyLinks(links: HeadLinkEntry[]): void {
  for (const entry of links) {
    if (!entry.rel || !entry.href) continue;
    const tag = document.createElement("link");
    tag.setAttribute(MANAGED_ATTR, "");
    for (const [key, value] of Object.entries(entry)) {
      if (value === undefined || value === null) continue;
      tag.setAttribute(key, String(value));
    }
    document.head.appendChild(tag);
  }
}

function applyScripts(scripts: HeadScriptEntry[]): void {
  for (const entry of scripts) {
    const tag = document.createElement("script");
    tag.setAttribute(MANAGED_ATTR, "");
    if (entry.type) tag.setAttribute("type", entry.type);
    if (typeof entry.children === "string") tag.textContent = entry.children;
    if (typeof entry.src === "string") tag.setAttribute("src", entry.src);
    document.head.appendChild(tag);
  }
}

function applyHead(head: HeadResult | undefined): void {
  clearManagedHead();
  if (!head) return;
  if (head.meta) applyMeta(head.meta);
  if (head.links) applyLinks(head.links);
  if (head.scripts) applyScripts(head.scripts);
}

/**
 * Applies the deepest matched route's `options.head` to document.head on
 * every navigation: document.title, meta tags, canonical links, and JSON-LD
 * scripts. Replaces the SSR `<HeadContent />` from the original root.
 */
function HeadManager(): null {
  const matches = useMatches();

  useEffect(() => {
    let headFn: unknown = null;
    let context: Record<string, unknown> = {};
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index] as unknown as {
        route?: { options?: { head?: unknown } };
        loaderData?: unknown;
        params?: unknown;
        search?: unknown;
      };
      const head = match.route?.options?.head;
      if (head !== undefined && head !== null) {
        headFn = head;
        context = {
          loaderData: match.loaderData,
          params: match.params,
          search: match.search,
        };
        break;
      }
    }
    if (typeof headFn === "function") {
      applyHead((headFn as (ctx: Record<string, unknown>) => HeadResult)(context));
    } else {
      applyHead(headFn as HeadResult | undefined);
    }
  }, [matches]);

  return null;
}

const queryClient = new QueryClient();

function SpaRootComponent() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <NesProvider loadFont={false}>
        <ThemeProvider initial={readAppearance()}>
          <HeadManager />
          <Outlet />
        </ThemeProvider>
      </NesProvider>
    </QueryClientProvider>
  );
}

export const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // staticData is required by the route-options type; unused by the SPA.
  staticData: { sitemap: false },
  component: SpaRootComponent,
});

export { queryClient };

import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NesBadge, NesButton, NesText } from "@/design-system/nes-229931";
import { useEditorAccess, useSession } from "@/hooks/useAuth";
import { EDITORIAL_AVAILABLE } from "@/lib/igdb.functions";
import { supabase } from "@/integrations/supabase/client";
import { siteSettingsQueryOptions } from "@/lib/publicData";
import { SiteFooter } from "@/components/SiteFooter";

/** Paths only editors and admins should be offered. */
const EDITOR_PATHS = new Set(["/import-search", "/imports", "/review"]);

/** Shown while site settings are still loading, so the header is never empty. */
const FALLBACK_NAV = [
  { label: "Home", path: "/" },
  { label: "Discover", path: "/discover" },
  { label: "Library", path: "/library" },
  { label: "Collections", path: "/collections" },
  { label: "About", path: "/about" },
];

/** Always offered, whatever site settings say. */
const PUBLIC_EXTRA_NAV = [
  { label: "Discover", path: "/discover" },
  { label: "Emoji Oracle", path: "/emoji" },
];

const SIGNED_IN_NAV = [
  { label: "My library", path: "/my-library" },
  { label: "Settings", path: "/settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: settings } = useQuery(siteSettingsQueryOptions);
  const { session } = useSession();
  const { data: access } = useEditorAccess(Boolean(session));
  const isEditor = Boolean(access?.role);
  // SpaceFast preview: the editorial import pipeline is intentionally out of
  // scope, so editor-only nav targets are hidden even for admins.
  const showEditorNav = isEditor && EDITORIAL_AVAILABLE;

  const sourceNav = settings?.primaryNavigation?.length ? settings.primaryNavigation : FALLBACK_NAV;
  const visibleNav = sourceNav.filter((item) => !EDITOR_PATHS.has(item.path) || showEditorNav);
  const candidates = [...visibleNav, ...PUBLIC_EXTRA_NAV, ...(session ? SIGNED_IN_NAV : [])];
  const seen = new Set<string>();
  const navItems = candidates.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
  const currentPath = router.state.location.pathname;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-row">
          <Link to="/">
            <NesText variant="primary" className="title-md">
              {settings?.appName ?? "QueerCade"}
            </NesText>
          </Link>
          <nav aria-label="Primary">
            <ul className="app-nav">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link to={item.path as LinkProps["to"]} data-active={currentPath === item.path}>
                    {item.label}
                  </Link>
                </li>
              ))}
              {showEditorNav ? (
                <li>
                  <Link to="/review" data-active={currentPath === "/review"}>
                    Review
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
          <div className="row">
            {access?.role ? <NesBadge variant="success">{access.role}</NesBadge> : null}
            {session ? (
              <NesButton
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  await router.navigate({ to: "/" });
                }}
              >
                Sign out
              </NesButton>
            ) : (
              <Link to="/auth">
                <NesButton type="button" variant="primary">
                  Sign in
                </NesButton>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="app-main">
        {children}
      </main>
      <footer className="app-footer">
        <NesText className="text-xs">
          {settings?.footerContent ?? "QueerCade — game data from IGDB, curation by humans."}
        </NesText>
        <SiteFooter />
      </footer>
    </div>
  );
}

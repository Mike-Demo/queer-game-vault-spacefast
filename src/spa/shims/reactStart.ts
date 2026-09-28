/**
 * Preview compatibility shim for `@tanstack/react-start`.
 *
 * Several original source files import from `@tanstack/react-start` and those
 * files must be reused unchanged in the SPA:
 *
 * - `src/routes/emoji.tsx`, `src/routes/profile.$username.tsx`,
 *   `src/hooks/useProfile.ts`, `src/hooks/useTracking.ts` import
 *   `useServerFn`. In the preview the "server functions" are already plain
 *   fetch-backed functions (the `src/spa/shims/*.functions` aliases), so
 *   `useServerFn(fn)` can return `fn` unchanged — the call signature
 *   `fn({ data })` is identical.
 * - `src/lib/theme/mode.ts` imports `createIsomorphicFn`. In the preview
 *   only the client implementation ever runs, so the isomorphic wrapper
 *   resolves to the `.client()` branch.
 *
 * A companion alias maps `@tanstack/react-start/server` to
 * `src/spa/shims/reactStartServer.ts` (only `getCookie`, never invoked in the
 * browser).
 */

/** Identity wrapper: preview server functions already fetch over HTTP. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

/** Resolves to the client implementation in the SPA (no SSR here). */
export function createIsomorphicFn() {
  return {
    client: <T>(fn: T) => ({
      server: (_serverFn: unknown): T => fn,
    }),
  };
}

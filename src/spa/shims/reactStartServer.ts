/**
 * Preview compatibility shim for `@tanstack/react-start/server`.
 *
 * Only `getCookie` is referenced by bundled code (`src/lib/theme/mode.ts`),
 * and only inside the `.server()` branch that the SPA never executes.
 * Exported for module-resolution completeness.
 */

export function getCookie(_name: string): string | undefined {
  return undefined;
}

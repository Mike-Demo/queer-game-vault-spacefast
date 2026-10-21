# Security audit follow-up backlog

The GitHub issue-creation tools are unavailable in this session, so the following
issue titles and bodies are ready to file. Each issue links back to
[parent issue #1](https://github.com/Mike-Demo/queer-game-vault-spacefast/issues/1).

## Priority order

1. **Public game detail exposes editor-only notes.** Anonymous callers can read
   editorial content for approved/featured games. The exposed information and
   direct public reach make this the higher-priority low-severity finding. Its
   smallest safe fix is to use a public projection without editorial fields and
   remove or gate the notes surface.
2. **Appreciation writes are not validated or deduplicated server-side.**
   Anonymous callers can create or increment rows for arbitrary slugs and
   bypass the browser-only per-visitor allowance. Addressing this requires both
   validating the game and enforcing a server-side limit or deduplication, so
   it is a broader fix.

## Ready-to-file remediation issues

### `[security][low] Prevent public exposure of editor notes`

**Parent:** #1

**Finding:** The public game-by-slug query applies `GAME_DETAIL_PROJECTION`,
which includes `editorNotes`, to approved/featured games. The unauthenticated
`fetchGame` server function returns that full detail to any caller, and the
game detail page renders an “Editor notes” surface without a role check.

**Root cause:** The public game-by-slug query reuses the full detail projection
that includes `editorNotes`, and neither the server function nor the page
strips or gates that field for anonymous principals.

**Smallest fix:** Use a public projection without `editorNotes` and other
editorial-only fields for `gameBySlugQuery` and public reads, and remove or
editor-gate the Editor notes surface. Keep `GAME_DETAIL_PROJECTION` only on the
`assertEditor`-guarded review-queue path.

### `[security][low] Validate and deduplicate appreciation writes`

**Parent:** #1

**Finding:** The appreciation POST handler applies only the shared rate limit
and a slug regex, never verifies that the slug resolves to a real approved
game, and calls the service-role RPC `increment_game_appreciation`, which
upserts and increments a row for any text slug. The intended per-visitor
allowance of 10 appreciations per game exists only as browser `localStorage`,
which a direct API caller can ignore.

**Root cause:** The write route performs no server-side game-existence check
and no durable per-principal/per-game deduplication before invoking a
service-role RPC that creates or increments a row for any supplied slug.

**Smallest fix:** Verify the slug resolves to an approved/featured game using
the Sanity public query before incrementing, and add durable
per-principal/per-game deduplication or a dedicated stricter limiter for this
write route.

## Ready-to-file needs-validation issue

### `[security][needs-validation] Audit leads to validate`

**Parent:** #1

No severity is assigned to these leads. Each item remains open until its exact
missing fact is established.

- [ ] **First-user-admin bootstrap in `handle_new_user` is a non-atomic
  count-then-insert** (`first-user-admin-bootstrap-race`). Claimed root cause:
  the bootstrap emptiness check and admin role insert are not atomic, so
  concurrent first signups may both receive the admin role. **Exact missing
  fact:** Whether two concurrent first signups against the actual
  Postgres/Supabase deployment both observe `count(*)=0` in `handle_new_user`
  and both receive the admin role (requires a concurrent-insert test against a
  database running these migrations, unavailable under the no-execution
  constraint).
- [ ] **IGDB-supplied link URLs have no scheme allowlist**
  (`igdb-link-url-scheme-not-validated`). Claimed root cause: no http/https
  scheme allowlist is applied to IGDB-supplied URLs between normalization,
  storage, and rendering. **Exact missing fact:** Whether IGDB's
  `websites[]`/`external_games[]` URL fields can contain a non-http(s) scheme
  such as `javascript:` for a game an editor can import (IGDB-side validation
  behavior is outside this repository's source).
- [ ] **Emoji-oracle GROQ guard may be bypassed with an unprojected or spread
  query** (`oracle-groq-guard-bypass-via-unprojected-query`). Claimed root
  cause: the guard checks substrings and a filter-pattern regex instead of
  confining the executed query to an allowlisted projection and document type,
  so an unprojected or spread query may return full documents including
  editor-only fields. **Exact missing fact:** Whether the Sanity MCP
  `query_documents` tool executes an unprojected or `{...}`-spread GROQ query
  as written and returns full game documents (including `editorNotes`/import
  fields), rather than enforcing its own projection or field filtering.
- [ ] **Rate-limit identity may be spoofable when `cf-connecting-ip` is absent**
  (`rate-limit-client-key-spoofable`). Claimed root cause: rate-limit identity
  is derived from forwarding headers that may be client-suppliable on the
  actual deployment, and the bucket map is cleared wholesale at 5000 keys.
  **Exact missing fact:** Whether the actual serving edge for this deployment
  (Cloudflare per `wrangler.jsonc`/Vite config, or SpaceFast per the repo name)
  always sets `cf-connecting-ip` and overwrites/strips inbound
  `x-forwarded-for` and `x-real-ip` before requests reach the app.

/**
 * Minimal wrapper around SpaceFast's env.DB (D1-shaped API over MySQL/MariaDB).
 *
 * Multi-user design: each registered visitor gets a row in `users` + `profiles`.
 * Timestamps are epoch milliseconds stored as BIGINT. Booleans are TINYINT.
 */

export interface DbStatement {
  bind(...params: unknown[]): DbResult;
}

export interface DbResult {
  all(): Promise<{ results: Record<string, unknown>[] }>;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
}

export interface SpacefastDb {
  prepare(sql: string): DbStatement;
}

function toDbValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export function q(db: SpacefastDb, sql: string, ...params: unknown[]): DbResult {
  return db.prepare(sql).bind(...params.map(toDbValue));
}

export async function all(
  db: SpacefastDb,
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown>[]> {
  const res = await q(db, sql, ...params).all();
  return res.results ?? [];
}

export async function first(
  db: SpacefastDb,
  sql: string,
  ...params: unknown[]
): Promise<Record<string, unknown> | null> {
  return (await q(db, sql, ...params).first()) ?? null;
}

export async function run(db: SpacefastDb, sql: string, ...params: unknown[]): Promise<void> {
  await q(db, sql, ...params).run();
}

/** Random id for users, profiles, roles, entries and picks. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(64) PRIMARY KEY,
    email TEXT NULL,
    display_name TEXT NULL,
    username VARCHAR(24) NULL UNIQUE,
    bio TEXT NULL,
    avatar_url TEXT NULL,
    profile_visibility VARCHAR(16) NOT NULL DEFAULT 'public',
    theme_preference VARCHAR(16) NOT NULL DEFAULT 'system',
    high_contrast TINYINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uniq_user_role (user_id, role)
  )`,
  `CREATE TABLE IF NOT EXISTS game_entries (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    igdb_id INT NOT NULL,
    game_slug VARCHAR(200) NOT NULL,
    title VARCHAR(300) NOT NULL,
    cover_url TEXT NULL,
    status VARCHAR(16) NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE KEY uniq_user_game (user_id, igdb_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_game_entries_user ON game_entries (user_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS emoji_picks (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    emojis TEXT NOT NULL,
    game_slug VARCHAR(200) NOT NULL,
    title VARCHAR(300) NOT NULL,
    cover_url TEXT NULL,
    reason TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emoji_picks_user ON emoji_picks (user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS game_appreciations (
    game_slug VARCHAR(200) PRIMARY KEY,
    total BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
  )`,
];

let schemaReady = false;

/** Creates the preview tables on first use. Idempotent. */
export async function ensureSchema(db: SpacefastDb): Promise<void> {
  if (schemaReady) return;
  for (const sql of SCHEMA_STATEMENTS) {
    await db.prepare(sql).bind().run();
  }
  schemaReady = true;
}

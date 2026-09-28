/**
 * Multi-user session auth for the QueerCade preview.
 *
 * Visitors register with email + password + username (stored in D1). A
 * successful login/register sets an httpOnly cookie holding
 * `userId.expiry.hmac`, where hmac = HMAC-SHA256(sessionSecret, "userId.expiry").
 *
 * Passwords are PBKDF2-SHA256 hashes (100k iterations, per-user salt) via
 * Web Crypto — no Node dependencies.
 */
import { AuthError } from "./http";
import { first, q, type CoreEnv, type SpacefastDb } from "./db";

export const COOKIE_NAME = "queercade_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
}

function sessionSecret(env: CoreEnv): string {
  return env.SESSION_SECRET ?? "";
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function sign(env: CoreEnv, payload: string): Promise<string> {
  const secret = sessionSecret(env);
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  const key = await hmacKey(secret);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

export async function createSessionCookie(env: CoreEnv, userId: string): Promise<string> {
  const expiry = String(Date.now() + SESSION_TTL_MS);
  const payload = `${userId}.${expiry}`;
  const sig = await sign(env, payload);
  return `${COOKIE_NAME}=${payload}.${sig}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax; Secure`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

/** Verifies the session cookie and returns the user id, or null. */
export async function verifySession(env: CoreEnv, request: Request): Promise<string | null> {
  const value = readSessionCookie(request);
  if (!value) return null;
  const [userId, expiry, sig] = value.split(".");
  if (!userId || !expiry || !sig) return null;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return null;
  const expected = await sign(env, `${userId}.${expiry}`);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  return userId;
}

/** Requires a valid session; throws AuthError otherwise. */
export async function requireUser(env: CoreEnv, request: Request): Promise<string> {
  const userId = await verifySession(env, request);
  if (!userId) throw new AuthError("Sign in to continue.");
  const row = await first(env.db, "SELECT id FROM users WHERE id = ?", userId);
  if (!row) throw new AuthError("Sign in to continue.");
  return userId;
}

const PBKDF2_ITERATIONS = 100_000;

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Hashes a password with a fresh random salt. Returns the stored form. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(new Uint8Array(bits))}`;
}

/** Constant-time-ish verification of a password against its stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltB64 || !hashB64) return false;
  const iterations = Number(iter);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = b64decode(saltB64);
  const expected = b64decode(hashB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
      key,
      expected.length * 8,
    ),
  );
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i]! ^ expected[i]!;
  return diff === 0;
}

export { q };
export type { SpacefastDb };

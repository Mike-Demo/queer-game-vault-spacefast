/**
 * POST /api/oracle — the Emoji Oracle. Body { emojis: string[] }.
 * Same validation as the original (`EMOJI_MEANINGS` membership, MIN..MAX
 * unique emojis), same 6/min IP rate limit, same OracleResponse shape.
 * Without OPENAI_API_KEY → { ok:false, message:"The oracle is not configured." }.
 */
import { apiError, InputError, json, withErrors } from "../_core/http";
import { initRequest, type RouteContext } from "../_core/request";
import {
  EMOJI_MEANINGS,
  MAX_EMOJIS,
  MIN_EMOJIS,
  OracleError,
  oracleRateLimited,
  suggestGameFromEmojis,
} from "../_core/oracle";

function parseEmojis(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new InputError("invalid_request", "Pick some emojis first.");
  }
  const emojis = (input as { emojis?: unknown }).emojis;
  if (!Array.isArray(emojis)) throw new InputError("invalid_request", "Pick some emojis first.");
  if (emojis.length < MIN_EMOJIS || emojis.length > MAX_EMOJIS) {
    throw new InputError(
      "invalid_request",
      `Pick between ${MIN_EMOJIS} and ${MAX_EMOJIS} different emojis.`,
    );
  }
  for (const emoji of emojis) {
    if (typeof emoji !== "string" || !EMOJI_MEANINGS.has(emoji)) {
      throw new InputError("invalid_request", "One of those emojis is not on the board.");
    }
  }
  if (new Set(emojis).size !== emojis.length) {
    throw new InputError("invalid_request", "Pick each emoji only once.");
  }
  return emojis as string[];
}

const handle = withErrors(async (request: Request, context: RouteContext): Promise<Response> => {
  const { env, ip } = await initRequest(request, context);
  if (request.method !== "POST") return apiError(405, "invalid_request", "Method not allowed.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InputError("invalid_request", "Request body must be JSON.");
  }
  const emojis = parseEmojis(body);

  if (oracleRateLimited(ip)) {
    return json({ ok: false, message: "Too many tries. Please wait a minute." });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return json({ ok: false, message: "The oracle is not configured." });

  try {
    const result = await suggestGameFromEmojis(emojis, apiKey);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof OracleError) return json({ ok: false, message: error.message });
    console.error("Emoji oracle failed", error);
    return json({ ok: false, message: "The oracle could not think of a game right now. Please try again." });
  }
});

/** SpaceFast Functions entries: one export per HTTP method. */
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;

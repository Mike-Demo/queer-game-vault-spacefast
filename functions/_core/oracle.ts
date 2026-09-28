/**
 * Self-contained port of the Emoji Oracle pieces from
 * `src/lib/emojiOracle/oracle.server.ts` (constants, guards, parseAnswer) and
 * `src/lib/emojiOracle/emojis.ts` (EMOJI_MEANINGS).
 *
 * The Sanity MCP session is replaced with `sanityFetch` + the same query
 * guards; the Lovable AI gateway client is replaced with a dependency-free
 * OpenAI chat-completions tool loop (the Functions runtime ships only the
 * files under functions/, so no npm imports are used here). Model is a real
 * OpenAI model since the Lovable gateway name ("openai/gpt-6-astra") is not
 * a direct OpenAI model id.
 */
import { sanityFetch } from "./sanity";
import { GAME_SUMMARY_PROJECTION } from "./queries";
import type { GameSummary } from "./public-api";

/** The fixed emoji set visitors can pick from. The server only accepts these. */
export interface EmojiGroup {
  readonly label: string;
  readonly items: readonly { readonly emoji: string; readonly meaning: string }[];
}

export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  {
    label: "Mood",
    items: [
      { emoji: "😊", meaning: "happy, uplifting" },
      { emoji: "😢", meaning: "sad, emotional" },
      { emoji: "😱", meaning: "scary, horror" },
      { emoji: "😌", meaning: "calm, relaxing" },
      { emoji: "😂", meaning: "funny, comedic" },
      { emoji: "🥰", meaning: "romantic, loving" },
    ],
  },
  {
    label: "Vibe",
    items: [
      { emoji: "🌈", meaning: "pride, colorful" },
      { emoji: "✨", meaning: "magical, whimsical" },
      { emoji: "🔥", meaning: "intense, action-packed" },
      { emoji: "🌙", meaning: "dark, moody, nighttime" },
      { emoji: "🎶", meaning: "music, rhythm" },
      { emoji: "💀", meaning: "death, grim" },
    ],
  },
  {
    label: "Setting",
    items: [
      { emoji: "🚀", meaning: "space, sci-fi" },
      { emoji: "🏰", meaning: "fantasy, medieval" },
      { emoji: "🌆", meaning: "city, modern" },
      { emoji: "🌲", meaning: "nature, forest" },
      { emoji: "🌊", meaning: "ocean, water" },
      { emoji: "🤖", meaning: "robots, cyberpunk" },
    ],
  },
  {
    label: "Playstyle",
    items: [
      { emoji: "⚔️", meaning: "combat, fighting" },
      { emoji: "🧩", meaning: "puzzles" },
      { emoji: "📖", meaning: "story-rich, visual novel" },
      { emoji: "🌾", meaning: "farming, cozy life sim" },
      { emoji: "🔍", meaning: "mystery, investigation" },
      { emoji: "👥", meaning: "multiplayer, co-op" },
    ],
  },
];

export const EMOJI_MEANINGS: ReadonlyMap<string, string> = new Map(
  EMOJI_GROUPS.flatMap((group) => group.items.map((item) => [item.emoji, item.meaning] as const)),
);

export const MIN_EMOJIS = 3;
export const MAX_EMOJIS = 5;

export interface EmojiMatch {
  readonly emoji: string;
  readonly meaning: string;
}

export interface EmojiPick {
  readonly id: string;
  readonly emojis: string[];
  readonly gameSlug: string;
  readonly title: string;
  readonly coverUrl: string | null;
  readonly reason: string;
  readonly createdAt: string;
}

export type OracleResponse =
  | { ok: true; game: GameSummary; reason: string; matches: EmojiMatch[] }
  | { ok: false; message: string };

const MODEL = "gpt-4o-mini";
const MAX_TOOL_STEPS = 50;

/** Fields that must never be read by the agent. */
const BLOCKED_TERMS = ["editorNotes", "importRecord", "importStatus", "sources", "drafts.", "profile", "siteSettings"];

export class OracleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const SYSTEM_PROMPT = `You are the QueerCade Emoji Oracle. A visitor picked emojis; suggest exactly ONE game from the QueerCade catalog that best matches them.
Use the query_catalog tool (GROQ against Sanity). Every query MUST include the filter: _type == "game" && editorialStatus in ["approved", "featured"].
Useful fields: title, "slug": slug.current, summary, customDescription, themes, gameModes, "genres": genres[]->name, "characters": lgbtqCharacters[].name, releaseYear.
Keep projections small and slice results (e.g. [0...40]). Useful patterns: themes match "Horror", genres[]->name match "Puzzle", summary match "space".
Do 2-5 queries, then answer. Your final message must be ONLY this JSON, no prose:
{"slug": "<game slug>", "reason": "<one friendly sentence, max 160 chars>", "matches": [{"emoji": "<emoji>", "meaning": "<what it matched in the game, max 60 chars>"}]}`;

interface OracleAnswer {
  slug: string;
  reason: string;
  matches: EmojiMatch[];
}

function parseAnswer(text: string): OracleAnswer | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Partial<OracleAnswer>;
    if (typeof raw.slug !== "string" || typeof raw.reason !== "string") return null;
    const matches = Array.isArray(raw.matches)
      ? raw.matches
          .filter((m): m is EmojiMatch => typeof m?.emoji === "string" && typeof m?.meaning === "string")
          .map((m) => ({ emoji: m.emoji.slice(0, 8), meaning: m.meaning.slice(0, 80) }))
      : [];
    return { slug: raw.slug.trim(), reason: raw.reason.trim().slice(0, 240), matches };
  } catch {
    return null;
  }
}

export interface OracleResult {
  game: GameSummary;
  reason: string;
  matches: EmojiMatch[];
}

function providerError(error: unknown): OracleError {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 402) return new OracleError("The oracle is out of AI credits for now. Please try again later.", 402);
  if (status === 429) return new OracleError("The oracle is busy. Please wait a minute and try again.", 429);
  if (status === 403) return new OracleError("The oracle is not available right now.", 403);
  return new OracleError("The oracle could not think of a game right now. Please try again.", 503);
}

/** Runs one read-only GROQ query against the published catalog with the tool guards. */
async function queryCatalog(groq: string): Promise<string> {
  if (BLOCKED_TERMS.some((term) => groq.includes(term))) return "That field is not available.";
  if (!/editorialStatus\s+in\s*\[/.test(groq)) {
    return 'Rejected: include editorialStatus in ["approved", "featured"] in the filter.';
  }
  const result = await sanityFetch<unknown>(groq.slice(0, 2000));
  return JSON.stringify(result).slice(0, 12000);
}

export async function suggestGameFromEmojis(emojis: string[], apiKey: string): Promise<OracleResult> {
  const picked = emojis.map((emoji) => `${emoji} (${EMOJI_MEANINGS.get(emoji) ?? ""})`).join(", ");

  const toolDefinition = {
    type: "function" as const,
    function: {
      name: "query_catalog",
      description: "Run a read-only GROQ query against the published QueerCade game catalog.",
      parameters: {
        type: "object",
        properties: { groq: { type: "string" } },
        required: ["groq"],
      },
    },
  };

  interface ChatMessage {
    role: string;
    content: string | null;
    tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
    tool_call_id?: string;
    name?: string;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Emojis picked: ${picked}` },
  ];

  let text = "";
  try {
    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages, tools: [toolDefinition], tool_choice: "auto" }),
      });
      if (!response.ok) {
        const status = response.status;
        if (status === 429) throw new OracleError("The oracle is busy. Please wait a minute and try again.", 429);
        if (status === 403 || status === 401)
          throw new OracleError("The oracle is not available right now.", 403);
        throw new OracleError("The oracle could not think of a game right now. Please try again.", 503);
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ChatMessage["tool_calls"] } }[];
      };
      const message = body.choices?.[0]?.message;
      if (!message) throw new OracleError("The oracle could not think of a game right now. Please try again.", 503);

      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
      const calls = message.tool_calls ?? [];
      if (calls.length === 0) {
        text = message.content ?? "";
        break;
      }
      for (const call of calls) {
        let args: { groq?: unknown } = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as { groq?: unknown };
        } catch {
          args = {};
        }
        const result = typeof args.groq === "string" ? await queryCatalog(args.groq) : "Invalid query.";
        messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: result });
      }
    }
  } catch (error) {
    if (error instanceof OracleError) throw error;
    throw providerError(error);
  }

  const answer = parseAnswer(text);
  if (!answer || !/^[a-z0-9-]{1,120}$/.test(answer.slug)) {
    throw new OracleError("The oracle couldn't find a match. Try different emojis.", 404);
  }
  const game = await sanityFetch<GameSummary | null>(
    `*[_type == "game" && editorialStatus in ["approved", "featured"] && slug.current == $slug][0] ${GAME_SUMMARY_PROJECTION}`,
    { slug: answer.slug },
  );
  if (!game) throw new OracleError("The oracle couldn't find a match. Try different emojis.", 404);
  return { game, reason: answer.reason, matches: answer.matches.filter((m) => emojis.includes(m.emoji)) };
}

const ORACLE_WINDOW_MS = 60_000;
const ORACLE_MAX_PER_WINDOW = 6;
const oracleBuckets = new Map<string, { count: number; resetAt: number }>();

/** Per-IP fixed-window limiter for the oracle (6 requests per minute). */
export function oracleRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = oracleBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    oracleBuckets.set(key, { count: 1, resetAt: now + ORACLE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > ORACLE_MAX_PER_WINDOW;
}

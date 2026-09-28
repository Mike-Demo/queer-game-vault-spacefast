/**
 * Preview shim for `@/lib/emojiOracle.functions`.
 *
 * Same names and call signatures as the original TanStack Start server
 * functions, backed by `fetch` against the SpaceFast Functions API:
 * `POST /api/oracle`, `GET|POST /api/emoji-picks`.
 */
import type { EmojiMatch, EmojiPick } from "@/lib/emojiOracle/emojis";
import type { GameSummary } from "@/lib/sanity/types";

export type OracleResponse =
  | { ok: true; game: GameSummary; reason: string; matches: EmojiMatch[] }
  | { ok: false; message: string };

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (body && typeof body.error === "string" && body.error.length > 0) return body.error;
    if (body && typeof body.message === "string" && body.message.length > 0) return body.message;
  } catch {
    /* fall through to the generic message */
  }
  return `The oracle could not be reached (HTTP ${res.status}). Please try again.`;
}

/** Public: suggest one approved game for the chosen emojis. */
export const askEmojiOracle = async ({
  data,
}: {
  data: { emojis: string[] };
}): Promise<OracleResponse> => {
  const res = await fetch("/api/oracle", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ emojis: data.emojis }),
  });
  if (!res.ok) return { ok: false, message: await readErrorMessage(res) };
  return (await res.json()) as OracleResponse;
};

export interface SaveEmojiPickInput {
  emojis: string[];
  gameSlug: string;
  title: string;
  coverUrl: string | null;
  reason: string;
}

/** Save one oracle pick for the signed-in person. */
export const saveEmojiPick = async ({
  data,
}: {
  data: SaveEmojiPickInput;
}): Promise<{ ok: true }> => {
  const res = await fetch("/api/emoji-picks", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      emojis: data.emojis,
      gameSlug: data.gameSlug,
      title: data.title,
      coverUrl: data.coverUrl,
      reason: data.reason,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as { ok: true };
};

/** The signed-in person's past picks, newest first. */
export const listEmojiPicks = async (): Promise<EmojiPick[]> => {
  const res = await fetch("/api/emoji-picks", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as EmojiPick[];
};

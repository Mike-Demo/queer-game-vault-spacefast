/**
 * Per-request context for SpaceFast function routes.
 */
import { ensureSchema, type SpacefastDb } from "./db";

export interface CoreEnv {
  db: SpacefastDb;
  /** HMAC secret for signing session cookies. Required for auth routes. */
  SESSION_SECRET?: string | undefined;
  /** OpenAI API key for the Emoji Oracle. Optional. */
  OPENAI_API_KEY?: string | undefined;
}

export interface CoreContext {
  env: CoreEnv;
  /** Caller IP as resolved from proxy headers, or "unknown". */
  ip: string;
}

export interface RouteContext {
  params: Record<string, string | string[] | undefined>;
  env: Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getClientIp(request: Request): string {
  const direct = request.headers.get("cf-connecting-ip");
  if (direct) return direct;
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export async function initRequest(request: Request, context: RouteContext): Promise<CoreContext> {
  const rawDb = context.env["DB"];
  if (!rawDb || typeof (rawDb as { prepare?: unknown }).prepare !== "function") {
    throw new Error("The database binding (env.DB) is not configured for this space.");
  }
  const db = rawDb as SpacefastDb;
  await ensureSchema(db);
  return {
    env: {
      db,
      SESSION_SECRET: asString(context.env["SESSION_SECRET"]),
      OPENAI_API_KEY: asString(context.env["OPENAI_API_KEY"]),
    },
    ip: getClientIp(request),
  };
}

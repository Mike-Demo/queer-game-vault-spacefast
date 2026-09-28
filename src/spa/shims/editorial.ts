/**
 * Preview shim for `@/lib/editorial.functions`.
 *
 * The editorial import pipeline (import-search, imports, review) needs
 * production Sanity/IGDB secrets and is intentionally unavailable in the
 * SpaceFast preview. Every export throws so any accidental use fails loudly
 * instead of silently doing nothing.
 */
import type { GameDetail, ImportRecordEntry } from "@/lib/sanity/types";

const UNAVAILABLE = "Editorial import is not available in the SpaceFast preview.";

export interface ImportSummary {
  outcomes: unknown[];
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  warnings: number;
  error: string | null;
}

/** Import or refresh one or more IGDB games into Sanity. Editors and admins only. */
export const importGamesFromIgdb = (_input: {
  data: { igdbIds: number[]; updateExisting?: boolean };
}): Promise<ImportSummary> => {
  throw new Error(UNAVAILABLE);
};

export interface ReviewQueueResponse {
  games: GameDetail[];
  collections: { _id: string; title: string }[];
  error: string | null;
}

/** Review queue plus collection targets. Authorized read, never cached. */
export const getReviewQueue = (): Promise<ReviewQueueResponse> => {
  throw new Error(UNAVAILABLE);
};

/** Editor-owned updates: status, feature flag, custom copy, notes. */
export const updateGameEditorial = (_input: {
  data: {
    gameId: string;
    editorialStatus?: string;
    featured?: boolean;
    customDescription?: string;
    editorNotes?: string;
  };
}): Promise<{ ok: boolean; error: string | null }> => {
  throw new Error(UNAVAILABLE);
};

/** Adds a reviewed game to a curated collection. */
export const addGameToCollection = (_input: {
  data: { gameId: string; collectionId: string };
}): Promise<{ ok: boolean; error: string | null }> => {
  throw new Error(UNAVAILABLE);
};

/** Import history for the /imports screen. Authorized, uncached. */
export const getImportHistory = (): Promise<{ records: ImportRecordEntry[]; error: string | null }> => {
  throw new Error(UNAVAILABLE);
};

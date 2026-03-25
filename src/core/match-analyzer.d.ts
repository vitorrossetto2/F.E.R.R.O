import type { SessionSummary } from "../shared/types.js";

export interface SessionAnalysis {
  [key: string]: unknown;
}

export function listSessionSummaries(sourceDir: string): Promise<SessionSummary[]>;

export function getSessionAnalysis(sourceDir: string, sessionId: string): Promise<SessionAnalysis>;
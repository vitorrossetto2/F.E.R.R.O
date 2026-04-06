import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { settings } from "./config";
import type { LLMTransport } from "./llm";

export interface LlmInteractionEntry {
  label?: string;
  transport: LLMTransport;
  endpoint: string;
  model: string;
  request: unknown;
  response: unknown;
  responseText: string;
  usage: unknown;
  error: string | null;
  durationMs: number;
}

let database: DatabaseSync | null = null;
let databasePathCache: string | null = null;

function resolveLogsDir(): string {
  return process.env.LOGS_DIR?.trim() || settings.logsDir;
}

export function getLlmDatabasePath(logsDir = resolveLogsDir()): string {
  return path.resolve(logsDir, "llm.sqlite");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ serializationError: "Unable to serialize value" });
  }
}

function openDatabase(dbPath = getLlmDatabasePath()): DatabaseSync {
  if (database && databasePathCache === dbPath) {
    return database;
  }

  if (database && databasePathCache !== dbPath) {
    try {
      database.close();
    } catch {
      // Ignore close errors when switching paths; the new database still needs to open.
    }
    database = null;
  }

  databasePathCache = dbPath;
  database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS llm_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      label TEXT,
      transport TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      model TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT,
      response_text TEXT,
      usage_json TEXT,
      error TEXT,
      duration_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_created_at
      ON llm_interactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_label
      ON llm_interactions(label);
  `);

  return database;
}

export async function recordLlmInteraction(entry: LlmInteractionEntry): Promise<void> {
  try {
    const dbPath = getLlmDatabasePath();
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openDatabase(dbPath);
    const stmt = db.prepare(`
      INSERT INTO llm_interactions (
        created_at,
        label,
        transport,
        endpoint,
        model,
        request_json,
        response_json,
        response_text,
        usage_json,
        error,
        duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      new Date().toISOString(),
      entry.label ?? null,
      entry.transport,
      entry.endpoint,
      entry.model,
      safeJson(entry.request),
      entry.response === null ? null : safeJson(entry.response),
      entry.responseText || null,
      entry.usage === null ? null : safeJson(entry.usage),
      entry.error,
      Math.max(0, Math.round(entry.durationMs))
    );
  } catch (error) {
    console.warn("[LLM-DB] Failed to record interaction:", (error as Error).message);
  }
}

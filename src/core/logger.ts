import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

import { settings } from "./config";
import type { CoreLogger, LoggerPayload, LoggerSessionInfo } from "./types";

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function makeAppender(filePath: string, sessionId: string) {
  return async function log(type: string, payload: LoggerPayload = {}): Promise<void> {
    const entry = {
      ts: new Date().toISOString(),
      sessionId,
      type,
      ...payload
    };

    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  };
}

export async function createLogger(mode = "game"): Promise<CoreLogger> {
  const baseDir = mode === "test" ? "test" : "";
  const systemDir = path.resolve(settings.logsDir, baseDir, "system");
  const gameDir = path.resolve(settings.logsDir, baseDir, "game");
  await mkdir(systemDir, { recursive: true });
  await mkdir(gameDir, { recursive: true });

  const sessionId = timestampForFile();
  let filePath = path.resolve(systemDir, `session-${sessionId}.jsonl`);
  let gameFilePath = path.resolve(gameDir, `session-${sessionId}.jsonl`);

  let log = makeAppender(filePath, sessionId);
  let logGame = makeAppender(gameFilePath, sessionId);

  await log("app_start", {
    pid: process.pid,
    cwd: process.cwd(),
    model: settings.zaiModel,
    ttsProvider: settings.ttsProvider,
    mode
  });

  async function newSession(): Promise<LoggerSessionInfo> {
    const newSessionId = timestampForFile();
    filePath = path.resolve(systemDir, `session-${newSessionId}.jsonl`);
    gameFilePath = path.resolve(gameDir, `session-${newSessionId}.jsonl`);
    log = makeAppender(filePath, newSessionId);
    logGame = makeAppender(gameFilePath, newSessionId);

    await log("session_start", {
      pid: process.pid,
      previousSessionId: sessionId
    });

    return { sessionId: newSessionId, filePath, gameFilePath };
  }

  return {
    get sessionId() { return sessionId; },
    get filePath() { return filePath; },
    get gameFilePath() { return gameFilePath; },
    log(type: string, payload?: LoggerPayload) { return log(type, payload); },
    logGame(type: string, payload?: LoggerPayload) { return logGame(type, payload); },
    newSession
  };
}

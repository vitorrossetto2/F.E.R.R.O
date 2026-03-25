import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { ElevenLabsUsageSummary } from "../../shared/types.js";

const ELEVENLABS_STARTER_USD = 5;
const ELEVENLABS_STARTER_CREDITS = 30000;
const BRL_PER_USD = 5.5;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSummary(sessionId: string, totalChars: number, ttsCount: number, durationSeconds: number): ElevenLabsUsageSummary {
  const estimatedCredits = totalChars;
  const costBRL = (estimatedCredits / ELEVENLABS_STARTER_CREDITS) * ELEVENLABS_STARTER_USD * BRL_PER_USD;

  return {
    sessionId,
    ttsCount,
    totalChars,
    estimatedCredits,
    averageCharsPerMessage: round(totalChars / ttsCount),
    durationSeconds: round(durationSeconds),
    costBRL: round(costBRL),
  };
}

export async function getLatestElevenLabsUsageSummary(logsDir: string): Promise<ElevenLabsUsageSummary | null> {
  const systemDir = path.join(logsDir, "system");

  let files: string[];
  try {
    files = await readdir(systemDir);
  } catch {
    return null;
  }

  const sessionFiles = files
    .filter((file) => file.startsWith("session-") && file.endsWith(".jsonl"))
    .sort();

  for (let index = sessionFiles.length - 1; index >= 0; index -= 1) {
    const filename = sessionFiles[index];
    const filePath = path.join(systemDir, filename);

    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const sessionId = filename.replace(/^session-/, "").replace(/\.jsonl$/, "");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    let ttsCount = 0;
    let totalChars = 0;
    let durationSeconds = 0;

    for (const line of lines) {
      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (typeof entry.gameTime === "number" && entry.gameTime > durationSeconds) {
        durationSeconds = entry.gameTime;
      }

      if (entry.type !== "tts_success" || entry.provider !== "elevenlabs" || typeof entry.message !== "string") {
        continue;
      }

      ttsCount += 1;
      totalChars += entry.message.length;
    }

    if (ttsCount > 0 && totalChars > 0) {
      return buildSummary(sessionId, totalChars, ttsCount, durationSeconds);
    }
  }

  return null;
}

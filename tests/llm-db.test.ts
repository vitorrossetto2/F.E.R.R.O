import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

vi.mock("dotenv/config", () => ({}));

describe("llm db", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LOGS_DIR;
  });

  it("writes to the current LOGS_DIR at call time", async () => {
    const llmDb = await import("../src/core/llm-db.js");
    const logsDir = mkdtempSync(path.join(os.tmpdir(), "ferro-llm-runtime-"));
    process.env.LOGS_DIR = logsDir;

    await llmDb.recordLlmInteraction({
      label: "runtime-test",
      transport: "chat",
      endpoint: "https://api.example/v1/chat/completions",
      model: "glm-5",
      request: { prompt: "ping" },
      response: { ok: true },
      responseText: "pong",
      usage: null,
      error: null,
      durationMs: 12
    });

    const db = new DatabaseSync(path.join(logsDir, "llm.sqlite"), { readOnly: true });
    const rows = db.prepare("SELECT label, response_text FROM llm_interactions").all() as Array<{
      label: string | null;
      response_text: string | null;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("runtime-test");
    expect(rows[0].response_text).toBe("pong");
    db.close();
  });
});

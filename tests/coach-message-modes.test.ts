import { beforeEach, describe, expect, it, vi } from "vitest";

let lastRequestBody: Record<string, unknown> | null = null;

vi.mock("dotenv/config", () => ({}));

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(async (requestBody: Record<string, unknown>) => {
          lastRequestBody = requestBody;
          return {
            choices: [{ message: { content: "Joga no alcance. Bate quando a skill chave sair." } }],
            usage: null,
          };
        }),
      },
    };
  }

  return { default: MockOpenAI };
});

describe("coach message modes", () => {
  beforeEach(() => {
    vi.resetModules();
    lastRequestBody = null;
    delete process.env.ZAI_API_KEY;
    delete process.env.ZAI_ENDPOINT;
    delete process.env.ZAI_MODEL;
    delete process.env.COACH_MESSAGE_MODE;
  });

  it("uses mode-specific heuristic fallback when LLM is disabled", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "puto";

    const result = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [] },
      ["inimigo counter antiCura"],
      { objectiveStates: [] }
    );

    expect(result.message).toBe("Compraram anti-cura. Sua sustain foi pro caralho.");
    expect(result.skippedLlm).toBe(true);
  });

  it("builds matchup prompt with the selected mode style", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "test-key";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "meme";

    await coachMod.getMatchupTip({
      activePlayerChampion: "Ahri",
      enemyPlayers: [{ championName: "Lux" }],
    });

    const messages = (lastRequestBody?.messages ?? []) as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Tom brincalhão");
  });
});

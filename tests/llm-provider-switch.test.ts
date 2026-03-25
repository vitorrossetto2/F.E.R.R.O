import { beforeEach, describe, expect, it, vi } from "vitest";

let storeData: Record<string, unknown> = {};
const openAiCalls: Array<{ apiKey: string; baseURL: string }> = [];

vi.mock("dotenv/config", () => ({}));
vi.mock("axios", () => ({
  default: { create: () => ({ get: async () => ({ data: {} }) }) },
}));
vi.mock("say", () => ({
  default: { speak: () => {} },
}));

vi.mock("electron-store", () => {
  return {
    default: class MockStore {
      constructor(opts: { defaults?: Record<string, unknown> }) {
        storeData = opts.defaults ? JSON.parse(JSON.stringify(opts.defaults)) : {};
      }

      get store() {
        return JSON.parse(JSON.stringify(storeData));
      }

      get(key: string) {
        const keys = key.split(".");
        let obj: unknown = storeData;
        for (const k of keys) {
          obj = (obj as Record<string, unknown>)?.[k];
        }
        return obj;
      }

      set(key: string, value: unknown) {
        const keys = key.split(".");
        let obj: Record<string, unknown> = storeData;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]] || typeof obj[keys[i]] !== "object") obj[keys[i]] = {};
          obj = obj[keys[i]] as Record<string, unknown>;
        }
        obj[keys[keys.length - 1]] = value;
      }

      clear() {
        storeData = {};
      }
    },
  };
});

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: "Troque cedo." } }],
          usage: null,
        })),
      },
    };

    constructor(opts: { apiKey: string; baseURL: string }) {
      openAiCalls.push(opts);
    }
  }

  return { default: MockOpenAI };
});

describe("LLM provider switching", () => {
  beforeEach(() => {
    vi.resetModules();
    storeData = {};
    openAiCalls.length = 0;
    delete process.env.ZAI_API_KEY;
    delete process.env.ZAI_ENDPOINT;
    delete process.env.ZAI_MODEL;
  });

  it("syncs engine llmStatus after enabling Z.AI in config", async () => {
    const configService = await import("../src/main/services/config-service.js");
    configService.initConfigStore();

    const { engine } = await import("../src/main/services/engine.js");
    expect(engine.engineState.llmStatus).toBe("disabled");

    configService.setPath("llm.activeProvider", "zai");
    configService.setPath("llm.providers.zai.apiKey", "test-key");
    configService.setPath("llm.providers.zai.model", "glm-5-turbo");
    engine.syncConfig();

    expect(engine.engineState.llmStatus).toBe("idle");
  });

  it("creates a fresh LLM client from the current runtime settings", async () => {
    process.env.ZAI_API_KEY = "first-key";
    process.env.ZAI_ENDPOINT = "https://first.example/v1/chat/completions";
    process.env.ZAI_MODEL = "glm-5";

    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");
    const snapshot = {
      activePlayerChampion: "Ahri",
      enemyPlayers: [{ championName: "Lux" }],
    };

    configMod.settings.zaiApiKey = "first-key";
    configMod.settings.zaiEndpoint = "https://first.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    await coachMod.getMatchupTip(snapshot);

    configMod.settings.zaiApiKey = "second-key";
    configMod.settings.zaiEndpoint = "https://second.example/custom/chat/completions";
    configMod.settings.zaiModel = "glm-5-turbo";
    await coachMod.getMatchupTip(snapshot);

    expect(openAiCalls).toEqual([
      { apiKey: "first-key", baseURL: "https://first.example/v1" },
      { apiKey: "second-key", baseURL: "https://second.example/custom" },
    ]);
  });

  it("skips matchup llm calls when the key is empty", async () => {
    process.env.ZAI_API_KEY = "";
    process.env.ZAI_ENDPOINT = "https://api.z.ai/api/coding/paas/v4/chat/completions";
    process.env.ZAI_MODEL = "glm-5";

    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.z.ai/api/coding/paas/v4/chat/completions";
    configMod.settings.zaiModel = "glm-5";

    const result = await coachMod.getMatchupTip({
      activePlayerChampion: "Ahri",
      enemyPlayers: [{ championName: "Lux" }],
    });

    expect(result).toBeNull();
    expect(openAiCalls).toHaveLength(0);
  });

  it("syncs coach message mode into loaded core settings without restart", async () => {
    const configService = await import("../src/main/services/config-service.js");
    configService.initConfigStore();

    const { engine } = await import("../src/main/services/engine.js");
    await (engine as unknown as { loadCore: () => Promise<void> }).loadCore();

    configService.setPath("coach.messageMode", "puto");
    engine.syncConfig();

    const configMod = await import("../src/core/config.js");
    expect(configMod.settings.coachMessageMode).toBe("puto");
  });
});

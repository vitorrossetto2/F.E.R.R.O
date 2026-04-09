import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let lastRequestBody: Record<string, unknown> | null = null;
let lastTransport: "chat" | "responses" | null = null;

vi.mock("dotenv/config", () => ({}));

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(async (requestBody: Record<string, unknown>) => {
          lastTransport = "chat";
          lastRequestBody = requestBody;
          return {
            choices: [{ message: { content: "Joga no alcance. Bate quando a skill chave sair." } }],
            usage: null,
          };
        }),
      },
    };

    responses = {
      create: vi.fn(async (requestBody: Record<string, unknown>) => {
        lastTransport = "responses";
        lastRequestBody = requestBody;
        return {
          output_text: "Joga no alcance. Bate quando a skill chave sair.",
          usage: null,
        };
      }),
    };
  }

  return { default: MockOpenAI };
});

describe("coach message modes", () => {
  beforeEach(() => {
    vi.resetModules();
    lastRequestBody = null;
    delete process.env.LOGS_DIR;
    delete process.env.ZAI_API_KEY;
    delete process.env.ZAI_ENDPOINT;
    delete process.env.ZAI_MODEL;
    delete process.env.COACH_MESSAGE_MODE;
    lastTransport = null;
  });

  it("stores llm interactions in sqlite", async () => {
    const logsDir = mkdtempSync(path.join(os.tmpdir(), "ferro-llm-"));
    process.env.LOGS_DIR = logsDir;

    try {
      const { runLlmTextRequest } = await import("../src/core/llm.js");

      await runLlmTextRequest({
        apiKey: "test-key",
        endpoint: "https://api.example/v1/chat/completions",
        model: "glm-5",
        label: "test",
        messages: [{ role: "user", content: "ping" }],
        maxOutputTokens: 8
      });

      const db = new DatabaseSync(path.join(logsDir, "llm.sqlite"), { readOnly: true });
      const rows = db.prepare("SELECT * FROM llm_interactions").all() as Array<{ label: string | null; request_json: string; response_text: string | null }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe("test");
      expect(rows[0].request_json).toContain("\"messages\"");
      expect(rows[0].response_text).toBe("Joga no alcance. Bate quando a skill chave sair.");
      db.close();
    } finally {
      delete process.env.LOGS_DIR;
    }
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

    expect(result.message).toContain("anti-cura");

    expect(result.skippedLlm).toBe(true);
  }, 15000);

  it("returns a generic matchup fallback when LLM is disabled", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "serio";

    const result = await coachMod.getMatchupTipWithFallback({
      gameTime: 180,
      activePlayerName: "Jogador",
      activePlayerChampion: "Jinx",
      activePlayerLevel: 3,
      activePlayerIsDead: false,
      activePlayerRespawnTimer: 0,
      activePlayerGold: 0,
      activePlayerTeam: "ORDER",
      activePlayerKda: "0/0/0",
      activePlayerPosition: "BOTTOM",
      alliedPlayers: [],
      enemyPlayers: [
        { summonerName: "LuxEnemy", championName: "Lux", level: 3, kills: 0, deaths: 0, assists: 0, creepScore: 0, currentGold: 0, items: [], position: "BOTTOM", wardScore: 0 }
      ],
      events: []
    });

    expect(result.message).toContain("Jinx");
    expect(result.message).toContain("Lux");
    expect(result.message).toMatch(/LLM orientar.*itemiza/i);
  }, 15000);
  it("changes the recommendation when the player champion changes", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";

    const jinx = await coachMod.getMatchupTipWithFallback({
      gameTime: 180,
      activePlayerName: "Jogador",
      activePlayerChampion: "Jinx",
      activePlayerLevel: 3,
      activePlayerIsDead: false,
      activePlayerRespawnTimer: 0,
      activePlayerGold: 0,
      activePlayerTeam: "ORDER",
      activePlayerKda: "0/0/0",
      activePlayerPosition: "BOTTOM",
      alliedPlayers: [],
      enemyPlayers: [
        { summonerName: "LuxEnemy", championName: "Lux", level: 3, kills: 0, deaths: 0, assists: 0, creepScore: 0, currentGold: 0, items: [], position: "BOTTOM", wardScore: 0 }
      ],
      events: []
    });

    const ahri = await coachMod.getMatchupTipWithFallback({
      gameTime: 180,
      activePlayerName: "Jogador",
      activePlayerChampion: "Ahri",
      activePlayerLevel: 3,
      activePlayerIsDead: false,
      activePlayerRespawnTimer: 0,
      activePlayerGold: 0,
      activePlayerTeam: "ORDER",
      activePlayerKda: "0/0/0",
      activePlayerPosition: "MID",
      alliedPlayers: [],
      enemyPlayers: [
        { summonerName: "LuxEnemy", championName: "Lux", level: 3, kills: 0, deaths: 0, assists: 0, creepScore: 0, currentGold: 0, items: [], position: "MID", wardScore: 0 }
      ],
      events: []
    });

    expect(jinx.message).not.toEqual(ahri.message);
    expect(jinx.message).toContain("Jinx");
    expect(ahri.message).toContain("Ahri");
  }, 15000);

  it("includes visible enemy build context in the coaching prompt", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "test-key";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "serio";

    const snapshot = {
      activePlayerChampion: "Jinx",
      activePlayerPosition: "BOTTOM",
      activePlayerGold: 0,
      enemyPlayers: [
        {
          summonerName: "DravenEnemy",
          championName: "Draven",
          level: 8,
          kills: 0,
          deaths: 0,
          assists: 0,
          creepScore: 0,
          currentGold: 0,
          items: [],
          position: "BOTTOM",
          wardScore: 0
        }
      ]
    } as any;

    const strategicContext = {
      objectiveStates: [],
      enemyBuilds: [
        {
          championName: "Draven",
          majorItemIds: new Set([3047]),
          majorItemDetails: [{ id: 3047, name: "Plated Steelcaps" }],
          itemNames: ["Plated Steelcaps"]
        }
      ]
    } as any;

    await coachMod.decideCoaching(snapshot, ["inimigo item: Draven:Plated Steelcaps"], strategicContext);

    const prompt = String((lastRequestBody?.messages as Array<{ role: string; content: string }> | undefined)?.[1]?.content ?? "");
    expect(prompt).toContain("Itens do jogador");
    expect(prompt).toMatch(/Itens vis.+veis do inimigo/);
    expect(prompt).toMatch(/Alvo prior.+rio: Draven/);
    expect(prompt).toMatch(/recomende itens que o jogador/i);
  }, 15000);
  it("includes owned items in the coaching prompt", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "test-key";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "serio";

    const snapshot = {
      activePlayerName: "Jogador",
      activePlayerChampion: "Jinx",
      activePlayerPosition: "BOTTOM",
      activePlayerGold: 0,
      enemyPlayers: [
        { summonerName: "DravenEnemy", championName: "Draven", level: 8, kills: 0, deaths: 0, assists: 0, creepScore: 0, currentGold: 0, items: [], position: "BOTTOM", wardScore: 0 }
      ],
      alliedPlayers: [
        {
          summonerName: "Jogador",
          championName: "Jinx",
          level: 10,
          kills: 0,
          deaths: 0,
          assists: 0,
          creepScore: 100,
          currentGold: 0,
          position: "BOTTOM",
          wardScore: 0,
          items: [
            { id: 3036, name: "Lembranças do Lorde Dominik" }
          ]
        }
      ]
    } as any;

    const strategicContext = {
      objectiveStates: [],
      enemyBuilds: [
        {
          championName: "Draven",
          majorItemIds: new Set([3047]),
          majorItemDetails: [{ id: 3047, name: "Passos de Aço Plated Steelcaps" }],
          itemNames: ["Passos de Aço Plated Steelcaps"]
        }
      ]
    } as any;

    await coachMod.decideCoaching(snapshot, ["inimigo item: Draven:Passos de Aço"], strategicContext);

    const prompt = String((lastRequestBody?.messages as Array<{ role: string; content: string }> | undefined)?.[1]?.content ?? "");
    expect(prompt).toContain("Dominik");
    expect(prompt).toContain("Plated Steelcaps");
    expect(prompt).toMatch(/recomende itens que o jogador/i);
  }, 15000);
  it("targets the strongest enemy threat in the coaching prompt when relevant", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "test-key";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";

    const snapshot = {
      activePlayerName: "Jogador",
      activePlayerChampion: "Jinx",
      activePlayerPosition: "BOTTOM",
      activePlayerGold: 0,
      alliedPlayers: [],
      enemyPlayers: [
        { summonerName: "DravenEnemy", championName: "Draven", level: 8, kills: 0, deaths: 0, assists: 0, creepScore: 0, currentGold: 0, items: [], position: "BOTTOM", wardScore: 0 },
        { summonerName: "ZedEnemy", championName: "Zed", level: 14, kills: 12, deaths: 1, assists: 3, creepScore: 200, currentGold: 0, items: [], position: "MID", wardScore: 0 }
      ]
    } as any;

    const strategicContext = {
      objectiveStates: [],
      enemyThreats: [
        {
          championName: "Zed",
          score: 99,
          kda: "12/1/3",
          build: ["Youmuu's Ghostblade"],
          majorItemCount: 2
        }
      ]
    } as any;

    await coachMod.decideCoaching(snapshot, ["inimigo item: Zed:Youmuu's Ghostblade"], strategicContext);

    const prompt = String((lastRequestBody?.messages as Array<{ role: string; content: string }> | undefined)?.[1]?.content ?? "");
    expect(prompt).toMatch(/Alvo prior.+rio: Zed/);
    expect(prompt).toMatch(/Itens vis.+veis do inimigo/);
  }, 15000);
  it("builds matchup prompt with the selected mode style", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "test-key";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "meme";

    await coachMod.getMatchupTipWithFallback({
      activePlayerChampion: "Ahri",
      enemyPlayers: [{ championName: "Lux" }],
    });

    const messages = (lastRequestBody?.messages ?? []) as Array<{ role: string; content: string }>;
    expect(lastTransport).toBe("chat");
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/Tom brincalh.*provocativo/);
  });

  it("fallback for 10-second timers uses 'está para nascer'", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");
    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "serio";

    const dragon = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [] },
      ["dragão em 10 segundos"],
      { objectiveStates: [] }
    );
    expect(dragon.message).toMatch(/drag.+est.+para nascer\./i);

    const grubs = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [] },
      ["vastilarvas em 10 segundos"],
      { objectiveStates: [] }
    );
    expect(grubs.message).toMatch(/vastilarvas est.+para nascer\./i);
  });

  it("does not turn tower warnings into death warnings", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");

    configMod.settings.zaiApiKey = "";
    configMod.settings.zaiEndpoint = "https://api.example/v1/chat/completions";
    configMod.settings.zaiModel = "glm-5";
    configMod.settings.coachMessageMode = "serio";

    const result = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [] },
      ["Perdemos torre do mid. Toma cuidado com rotas inimigas."],
      { objectiveStates: [] }
    );

    expect(result.message).toBe("Perdemos torre do mid. Toma cuidado com rotas inimigas.");
    expect(String(result.message)).not.toContain("Cuidado com Perdemos torre");
  });

  it("system prompt includes anti-generic rules", async () => {
    const { buildSystemPrompt } = await import("../src/core/constants.js");
    const prompt = buildSystemPrompt("serio");
    expect(prompt).toContain("Sempre mencione pelo menos um campeão");
    expect(prompt).toContain("NUNCA dê conselhos genéricos");
  });

  it("matchup prompt includes lane opponent rules", async () => {
    const { buildMatchupPrompt } = await import("../src/core/constants.js");
    const prompt = buildMatchupPrompt("serio");
    expect(prompt).toContain("Campeão inimigo");
    expect(prompt).toContain("Níveis 1–3");
  });

  it("no template produces preposition + {pronoun} without a noun", async () => {
    const { MESSAGE_MODE_PROFILES } = await import("../src/core/constants.js");
    const badPatterns = [/com \{pronoun\}/, /pra \{pronoun\}/, /contra \{pronoun\}/];
    for (const [mode, profile] of Object.entries(MESSAGE_MODE_PROFILES)) {
      for (const [key, phrases] of Object.entries(profile.phrases)) {
        for (const phrase of phrases as string[]) {
          for (const pattern of badPatterns) {
            expect(phrase, `${mode}/${key}: "${phrase}"`).not.toMatch(pattern);
          }
        }
      }
    }
  });
});

describe("new event categories", () => {
  beforeEach(() => { vi.resetModules(); });

  it("detectCategory recognizes all new trigger types", async () => {
    const { detectCategory } = await import("../src/core/coach.js");
    expect(detectCategory("ace inimigo")).toBe("ace");
    expect(detectCategory("ace aliado")).toBe("ace");
    expect(detectCategory("multikill inimigo: Shyvana:double kill")).toBe("multikill");
    expect(detectCategory("multikill aliado: Xerath:triple kill")).toBe("multikill");
    expect(detectCategory("roubaram dragão")).toBe("objetivoRoubo");
    expect(detectCategory("roubamos barão")).toBe("objetivoRoubo");
    expect(detectCategory("first blood aliado")).toBe("firstBlood");
    expect(detectCategory("first blood inimigo")).toBe("firstBlood");
    expect(detectCategory("inibidor inimigo voltou")).toBe("inibidorRespawn");
    expect(detectCategory("alma do dragão aliada: falta 1")).toBe("dragonSoul");
    expect(detectCategory("alma do dragão inimiga: falta 2")).toBe("dragonSoul");
    expect(detectCategory("cs alerta")).toBe("csAlerta");
    expect(detectCategory("ward alerta")).toBe("wardAlerta");
  });

  it("fallback message for ace inimigo produces non-empty text", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");
    configMod.settings.zaiApiKey = "";
    configMod.settings.coachMessageMode = "serio";
    const result = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [] },
      ["ace inimigo"], { objectiveStates: [] }
    );
    expect(result.message).toBeTruthy();
    expect(result.message.length).toBeGreaterThan(5);
  });
});

describe("jungle triggers", () => {
  beforeEach(() => { vi.resetModules(); });

  it("detectCategory recognizes jungle triggers", async () => {
    const { detectCategory } = await import("../src/core/coach.js");
    expect(detectCategory("gank oportunidade: bot vulnerável, Draven morreu")).toBe("jungleGank");
    expect(detectCategory("lane precisa de ajuda: top")).toBe("junglePressao");
  });

  it("jungle gank trigger produces a phrase with lane", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");
    configMod.settings.zaiApiKey = "";
    configMod.settings.coachMessageMode = "serio";

    const result = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [], activePlayerPosition: "JUNGLE" },
      ["gank oportunidade: bot vulnerável, Draven morreu"],
      { objectiveStates: [] }
    );
    expect(result.skippedLlm).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.message).toContain("bot");
  });

  it("jungle pressure trigger produces a phrase with lane", async () => {
    const configMod = await import("../src/core/config.js");
    const coachMod = await import("../src/core/coach.js");
    configMod.settings.zaiApiKey = "";
    configMod.settings.coachMessageMode = "serio";

    const result = await coachMod.decideCoaching(
      { activePlayerGold: 0, enemyPlayers: [], activePlayerPosition: "JUNGLE" },
      ["lane precisa de ajuda: top"],
      { objectiveStates: [] }
    );
    expect(result.skippedLlm).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.message).toContain("top");
  });
});




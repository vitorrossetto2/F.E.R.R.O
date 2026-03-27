import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Mock dotenv (config.js imports it)
vi.mock("dotenv/config", () => ({}));

// Mock axios (game.js imports it)
vi.mock("axios", () => ({
  default: { create: () => ({ get: async () => ({ data: {} }) }) },
}));

// Mock say (voice.js imports it)
vi.mock("say", () => ({
  default: { speak: () => {} },
}));

describe("core/constants.js", () => {
  it("CATEGORY_COOLDOWNS has all expected keys", async () => {
    const { CATEGORY_COOLDOWNS } = await import("../src/core/constants.js");
    const expected = [
      "mapa", "ouroParado", "inimigoFed", "inimigoBuild", "powerspike",
      "torre", "torrePerdida", "morteJogador", "morteStreak", "objetivo",
      "itemFechado", "inimigoItem", "levelUp", "inibidor", "fimDeJogo", "generico",
    ];
    for (const key of expected) {
      expect(CATEGORY_COOLDOWNS).toHaveProperty(key);
      expect(typeof CATEGORY_COOLDOWNS[key]).toBe("number");
    }
  });

  it("PHRASES has inicioPartida", async () => {
    const { PHRASES } = await import("../src/core/constants.js");
    expect(PHRASES.inicioPartida).toBeDefined();
    expect(PHRASES.inicioPartida.length).toBeGreaterThan(0);
  });

  it("buildSystemPrompt changes style by mode", async () => {
    const { buildSystemPrompt } = await import("../src/core/constants.js");
    expect(buildSystemPrompt("meme")).toContain("Tom brincalhão");
    expect(buildSystemPrompt("puto")).toContain("Tom puto");
  });

  it("falls back to serious phrases when a mode is missing a category", async () => {
    const { PHRASES, pickModePhrase } = await import("../src/core/constants.js");
    expect(pickModePhrase("torreTopDragao", "meme")).toBe(PHRASES.torreTopDragao[0]);
  });
});

describe("core/coach.js - detectCategory", () => {
  let detectCategory: (priority: string) => string;

  beforeAll(async () => {
    // Need process.env set for config.js
    process.env.ZAI_API_KEY = "test";
    process.env.ZAI_ENDPOINT = "https://fake.api/chat/completions";
    const mod = await import("../src/core/coach.js");
    detectCategory = mod.detectCategory;
  });

  it("returns 'mapa' for map reminder", () => {
    expect(detectCategory("lembrete de mapa")).toBe("mapa");
  });

  it("returns 'ouroParado' for stalled gold", () => {
    expect(detectCategory("ouro parado alto")).toBe("ouroParado");
  });

  it("returns 'inimigoFed' for fed enemy", () => {
    expect(detectCategory("inimigo fed: Jinx")).toBe("inimigoFed");
  });

  it("returns 'objetivo' for dragon timer", () => {
    expect(detectCategory("dragão em 30 segundos")).toBe("objetivo");
  });

  it("returns 'objetivo' for baron timer", () => {
    expect(detectCategory("barão nasceu agora")).toBe("objetivo");
  });

  it("returns 'torre' for tower fall", () => {
    expect(detectCategory("caiu torre mid")).toBe("torre");
  });

  it("returns 'torrePerdida' for allied tower loss", () => {
    expect(detectCategory("Perdemos torre mid")).toBe("torrePerdida");
  });

  it("returns 'morteJogador' for death warning", () => {
    expect(detectCategory("cuidado com Jinx")).toBe("morteJogador");
  });

  it("returns 'itemFechado' for item completion", () => {
    expect(detectCategory("item fechado: Infinity Edge")).toBe("itemFechado");
  });

  it("returns 'inimigoItem' for enemy item", () => {
    expect(detectCategory("inimigo item: Morellonomicon")).toBe("inimigoItem");
  });

  it("returns 'powerspike' for powerspike", () => {
    expect(detectCategory("powerspike: 2 itens")).toBe("powerspike");
  });

  it("returns 'generico' for unknown trigger", () => {
    expect(detectCategory("something random")).toBe("generico");
  });

  it("returns 'generico' for null/undefined", () => {
    expect(detectCategory(null as unknown as string)).toBe("generico");
    expect(detectCategory(undefined as unknown as string)).toBe("generico");
  });
});

describe("core/coach.js - getCategoryCooldown", () => {
  let getCategoryCooldown: (category: string) => number;

  beforeAll(async () => {
    process.env.ZAI_API_KEY = "test";
    const mod = await import("../src/core/coach.js");
    getCategoryCooldown = mod.getCategoryCooldown;
  });

  it("returns correct cooldowns for each category", () => {
    expect(getCategoryCooldown("mapa")).toBe(50);
    expect(getCategoryCooldown("objetivo")).toBe(15);
    expect(getCategoryCooldown("morteJogador")).toBe(90);
    expect(getCategoryCooldown("morteStreak")).toBe(180);
    expect(getCategoryCooldown("ouroParado")).toBe(120);
    expect(getCategoryCooldown("inimigoFed")).toBe(120);
    expect(getCategoryCooldown("generico")).toBe(30);
  });
});

describe("core/voice.js - toPhonetic", () => {
  let toPhonetic: (text: string) => string;

  beforeAll(async () => {
    process.env.TTS_PROVIDER = "piper";
    process.env.TTS_ENABLED = "true";
    const mod = await import("../src/core/voice.js");
    toPhonetic = mod.toPhonetic;
  });

  it("converts 'mid' to phonetic", () => {
    expect(toPhonetic("vá pro mid")).toContain("mídi");
  });

  it("converts 'build' to phonetic", () => {
    expect(toPhonetic("sua build")).toContain("bíudi");
  });

  it("converts 'powerspike' to phonetic", () => {
    expect(toPhonetic("powerspike agora")).toContain("páuer espáique");
  });

  it("converts 'jungle' to phonetic", () => {
    expect(toPhonetic("jungle inimigo")).toContain("djângou");
  });

  it("converts 'gank' to phonetic", () => {
    expect(toPhonetic("cuidado com gank")).toContain("guénqui");
  });

  it("preserves normal Portuguese text", () => {
    expect(toPhonetic("dragão nasce em trinta segundos")).toBe("dragão nasce em trinta segundos");
  });

  it("is case insensitive", () => {
    expect(toPhonetic("MID")).toContain("mídi");
    expect(toPhonetic("Mid")).toContain("mídi");
  });
});

describe("category priorities and cooldown groups", () => {
  beforeEach(() => { vi.resetModules(); });

  it("exports CATEGORY_PRIORITIES with correct values", async () => {
    const { CATEGORY_PRIORITIES } = await import("../src/core/constants.js");
    expect(CATEGORY_PRIORITIES.objetivo).toBe(3);
    expect(CATEGORY_PRIORITIES.fimDeJogo).toBe(3);
    expect(CATEGORY_PRIORITIES.torre).toBe(2);
    expect(CATEGORY_PRIORITIES.mapa).toBe(0);
    expect(CATEGORY_PRIORITIES.generico).toBe(0);
  });

  it("exports COOLDOWN_GROUPS mapping categories to group names", async () => {
    const { COOLDOWN_GROUPS } = await import("../src/core/constants.js");
    expect(COOLDOWN_GROUPS.inimigoFed).toBe("inimigoPerigo");
    expect(COOLDOWN_GROUPS.inimigoItem).toBe("inimigoPerigo");
    expect(COOLDOWN_GROUPS.inimigoBuild).toBe("inimigoPerigo");
    expect(COOLDOWN_GROUPS.mapa).toBeUndefined();
  });

  it("exports GROUP_COOLDOWN_SECONDS", async () => {
    const { GROUP_COOLDOWN_SECONDS } = await import("../src/core/constants.js");
    expect(GROUP_COOLDOWN_SECONDS).toBe(180);
  });
});

describe("phrase variation minimums", () => {
  beforeEach(() => { vi.resetModules(); });

  it("key categories have minimum phrase counts in all modes", async () => {
    const { MESSAGE_MODE_PROFILES } = await import("../src/core/constants.js");
    const minimums: Record<string, number> = {
      mapa: 8,
      inimigoFed: 6,
      inimigoItemPerigoso: 5,
      inimigoBuild: 5,
      ouroParado: 5,
    };

    for (const [mode, profile] of Object.entries(MESSAGE_MODE_PROFILES)) {
      for (const [key, min] of Object.entries(minimums)) {
        const phrases = profile.phrases[key] ?? [];
        expect(phrases.length, `${mode}/${key}: expected >= ${min}, got ${phrases.length}`).toBeGreaterThanOrEqual(min);
      }
    }
  });
});

describe("snapshot position field", () => {
  it("SnapshotPlayer includes position field", async () => {
    const player: import("../src/core/types").SnapshotPlayer = {
      summonerName: "Test", championName: "Ahri", level: 6,
      kills: 1, deaths: 0, assists: 2, creepScore: 80,
      currentGold: 1500, items: [], position: "MIDDLE"
    };
    expect(player.position).toBe("MIDDLE");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv/config", () => ({}));

vi.mock("../src/core/ddragon.js", () => ({
  getItemCatalog: vi.fn(async () => new Map()),
}));

describe("analyzer behavior", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function makeState() {
    return {
      lastCoachingAt: 0,
      lastMapReminderAt: 0,
      lastSeenEventCount: 0,
      lastActiveMajorItemCount: 0,
      enemyThreatItemCount: new Map(),
      announcedKeys: new Set(),
      lastAnalyzedGameTime: null,
      playerDeathCount: 0,
      matchupDone: false,
      lastActiveLevel: 0,
      lastEnemyLaneLevel: 0,
      seenActiveItemIds: new Set(),
      seenEnemyItemIds: new Map(),
      seenEnemyCounterTags: new Set(),
      hasLoggedWaitingState: false,
      lastGameTime: null,
      lastMessageTimes: new Map(),
      pendingTriggers: [],
    };
  }

  function makeSnapshot(overrides: Record<string, unknown> = {}) {
    return {
      gameTime: 832,
      activePlayerName: "TestPlayer",
      activePlayerChampion: "Jax",
      activePlayerLevel: 11,
      activePlayerGold: 1000,
      activePlayerTeam: "CHAOS",
      activePlayerKda: "3/2/1",
      activePlayerIsDead: false,
      alliedPlayers: [
        { summonerName: "TestPlayer",
          championName: "Jax",
          level: 11,
          kills: 3,
          deaths: 2,
          assists: 1,
          items: [],
        },
      ],
      enemyPlayers: [
        {
          summonerName: "EnemyTop",
          championName: "Volibear",
          level: 9,
          kills: 2,
          deaths: 4,
          assists: 0,
          items: [],
        },
      ],
      events: [],
      ...overrides,
    };
  }

  it("reports correct lane for CHAOS perspective (no flip)", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        {
          EventName: "TurretKilled",
          TurretKilled: "Turret_TOrder_L2_P3_1509986696_0",
        },
      ],
    });

    const result = await analyzeSnapshot(snapshot, makeState());

    // L2 = top lane — lanes are map-absolute (L0=bot, L1=mid, L2=top)
    expect(result.triggers.some((trigger) => String(trigger).includes("top"))).toBe(true);
    expect(result.triggers.some((trigger) => String(trigger).includes("bot"))).toBe(false);
  });

  it("does not emit map reminder while the player is dead", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      gameTime: 100,
      activePlayerIsDead: true,
      events: [],
    });
    const state = makeState();

    const result = await analyzeSnapshot(snapshot, state);

    expect(result.triggers).not.toContain("lembrete de mapa");
  });

  it("emits ace trigger when Ace event fires for enemy team", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      activePlayerTeam: "ORDER",
      events: [
        { EventName: "Ace", AcingTeam: "ORDER", Acer: "TestPlayer" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("ace inimigo"))).toBe(true);
  });

  it("emits allied ace trigger when own team is aced", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      activePlayerTeam: "ORDER",
      events: [
        { EventName: "Ace", AcingTeam: "CHAOS", Acer: "EnemyPlayer" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("ace aliado"))).toBe(true);
  });

  it("emits multikill trigger for enemy multikill", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        { EventName: "Multikill", KillerName: "EnemyTop", KillStreak: 2 },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("multikill inimigo"))).toBe(true);
  });

  it("emits multikill trigger for allied multikill", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        { EventName: "Multikill", KillerName: "TestPlayer", KillStreak: 3 },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("multikill aliado"))).toBe(true);
  });

  it("emits steal trigger when dragon is stolen by enemy", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        { EventName: "DragonKill", KillerName: "EnemyTop", Stolen: "True", DragonType: "Fire" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("roubaram dragão"))).toBe(true);
  });

  it("emits steal trigger when baron is stolen by ally", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        { EventName: "BaronKill", KillerName: "TestPlayer", Stolen: "True" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("roubamos barão"))).toBe(true);
  });

  it("emits first blood trigger for player", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      events: [
        { EventName: "FirstBlood", Recipient: "TestPlayer" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t === "first blood aliado")).toBe(true);
  });

  it("emits inhib respawned trigger", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const snapshot = makeSnapshot({
      activePlayerTeam: "ORDER",
      events: [
        { EventName: "InhibRespawned", InhibRespawned: "Inhib_TChaos_L1_P1_1931666598_0" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, makeState());
    expect(result.triggers.some((t) => t.includes("inibidor inimigo voltou"))).toBe(true);
  });
});

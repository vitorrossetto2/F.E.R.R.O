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
      allyDragonKills: 0,
      enemyDragonKills: 0,
      lastDragonSoulWarningAt: 0,
      lastCsCheckAt: 0,
      lastCsValue: 0,
      lastWardScoreCheckAt: 0,
      lastWardScore: 0,
      openingGreetingDone: false,
      lastSpeakGameTime: 0,
      lastGroupMessageTimes: new Map(),
      queueTriggers: () => {},
      drainPendingTriggers: () => [],
      canRepeatMessage: () => true,
      markMessageSpoken: () => {},
      canSpeakGlobal: () => true,
      markGlobalSpeak: () => {},
      canRepeatGroup: () => true,
      markGroupSpoken: () => {},
      reset: () => {},
      detectGameReset: () => false,
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
      activePlayerPosition: "TOP",
      activePlayerRespawnTimer: 0,
      alliedPlayers: [
        { summonerName: "TestPlayer",
          championName: "Jax",
          level: 11,
          kills: 3,
          deaths: 2,
          assists: 1,
          creepScore: 80,
          currentGold: 1000,
          items: [],
          position: "TOP",
          wardScore: 5,
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
          creepScore: 60,
          currentGold: 800,
          items: [],
          position: "TOP",
          wardScore: 3,
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

  it("emits dragon soul warning when ally team is 1 away", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    const events = [
      { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
      { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Earth", Stolen: "False" },
      { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Water", Stolen: "False" },
    ];
    const snapshot = makeSnapshot({ events, gameTime: 1200 });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t.includes("soul aliada"))).toBe(true);
  });

  it("emits enemy dragon soul warning when enemy is 1 away", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    const events = [
      { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Fire", Stolen: "False" },
      { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Earth", Stolen: "False" },
      { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Water", Stolen: "False" },
    ];
    const snapshot = makeSnapshot({ events, gameTime: 1200 });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t.includes("soul inimiga"))).toBe(true);
  });

  it("emits CS alert when CS/min is below threshold after 10 minutes", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    state.lastCsCheckAt = 0;
    state.lastCsValue = 0;
    const snapshot = makeSnapshot({
      gameTime: 900,
      alliedPlayers: [{
        summonerName: "TestPlayer", championName: "Jax", level: 11,
        kills: 3, deaths: 2, assists: 1, creepScore: 50, currentGold: 1000,
        items: [], position: "TOP", wardScore: 5
      }],
      activePlayerPosition: "TOP",
    });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t === "cs alerta")).toBe(true);
  });

  it("does not emit CS alert for junglers", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    const snapshot = makeSnapshot({
      gameTime: 900,
      alliedPlayers: [{
        summonerName: "TestPlayer", championName: "Jax", level: 11,
        kills: 3, deaths: 2, assists: 1, creepScore: 30, currentGold: 1000,
        items: [], position: "JUNGLE", wardScore: 5
      }],
      activePlayerPosition: "JUNGLE",
    });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t === "cs alerta")).toBe(false);
  });

  it("emits ward alert when ward score is low after 15 minutes", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    state.lastWardScoreCheckAt = 0;
    state.lastWardScore = 0;
    const snapshot = makeSnapshot({
      gameTime: 1200,
      alliedPlayers: [{
        summonerName: "TestPlayer", championName: "Jax", level: 14,
        kills: 3, deaths: 2, assists: 1, creepScore: 120, currentGold: 1000,
        items: [], position: "TOP", wardScore: 3
      }],
    });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t === "ward alerta")).toBe(true);
  });

  it("emits dragon type context when dragon is killed", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    const snapshot = makeSnapshot({
      events: [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, state);
    expect(result.triggers.some((t) => t.includes("dragão tipo: Fire"))).toBe(true);
  });

  it("handles multiple new events in a single snapshot", async () => {
    const { analyzeSnapshot } = await import("../src/core/analyzer.js");
    const state = makeState();
    const snapshot = makeSnapshot({
      gameTime: 1500,
      activePlayerTeam: "ORDER",
      alliedPlayers: [{
        summonerName: "TestPlayer", championName: "Jax", level: 14,
        kills: 5, deaths: 3, assists: 2, creepScore: 80, currentGold: 1000,
        items: [], position: "TOP", wardScore: 3
      }],
      events: [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Water", Stolen: "False" },
        { EventName: "Ace", AcingTeam: "CHAOS", Acer: "EnemyTop" },
      ],
    });
    const result = await analyzeSnapshot(snapshot, state);
    const triggerStr = result.triggers.join(" | ");

    // Should contain ace, dragon soul, and performance triggers
    expect(triggerStr).toContain("ace");
    expect(triggerStr).toContain("soul");
    // CS alert (80 CS at 25min = 3.2/min, very low)
    expect(result.triggers.some((t) => t === "cs alerta")).toBe(true);
    // Ward alert (3 wardScore at 25min, expected ~12.5)
    expect(result.triggers.some((t) => t === "ward alerta")).toBe(true);
  });
});

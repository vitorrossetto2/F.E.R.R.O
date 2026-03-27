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
      activePlayerName: "Mickael",
      activePlayerChampion: "Jax",
      activePlayerLevel: 11,
      activePlayerGold: 1000,
      activePlayerTeam: "CHAOS",
      activePlayerKda: "3/2/1",
      activePlayerIsDead: false,
      alliedPlayers: [
        {
          summonerName: "Mickael",
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

    // L2 = bot lane — lanes are map-absolute, no team-based swap
    expect(result.triggers.some((trigger) => String(trigger).includes("bot"))).toBe(true);
    expect(result.triggers.some((trigger) => String(trigger).includes("top"))).toBe(false);
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
});

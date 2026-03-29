import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv/config", () => ({}));

vi.mock("../src/core/ddragon.js", () => ({
  getItemCatalog: vi.fn(async () => new Map()),
}));

describe("bug fix regressions", () => {
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
      pendingTriggers: [] as string[],
      allyDragonKills: 0,
      enemyDragonKills: 0,
      lastAllyDragonSoulWarningAt: 0,
      lastEnemyDragonSoulWarningAt: 0,
      processedEventIds: new Set<number>(),
      lastCsCheckAt: 0,
      lastCsValue: 0,
      lastWardScoreCheckAt: 0,
      lastWardScore: 0,
      lastLaneGoldCheckAt: 0,
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
      activePlayerTeam: "ORDER",
      activePlayerKda: "3/2/1",
      activePlayerIsDead: false,
      activePlayerPosition: "TOP",
      activePlayerRespawnTimer: 0,
      alliedPlayers: [
        {
          summonerName: "TestPlayer", championName: "Jax", level: 11,
          kills: 3, deaths: 2, assists: 1, creepScore: 80, currentGold: 1000,
          items: [], position: "TOP", wardScore: 5,
        },
        {
          summonerName: "AllyJungle", championName: "JarvanIV", level: 10,
          kills: 2, deaths: 3, assists: 4, creepScore: 90, currentGold: 800,
          items: [], position: "JUNGLE", wardScore: 8,
        },
      ],
      enemyPlayers: [
        {
          summonerName: "EnemyTop", championName: "Aatrox", level: 12,
          kills: 5, deaths: 1, assists: 2, creepScore: 100, currentGold: 1200,
          items: [], position: "TOP", wardScore: 4,
        },
        {
          summonerName: "EnemyMid", championName: "Mel", level: 10,
          kills: 2, deaths: 2, assists: 3, creepScore: 90, currentGold: 900,
          items: [], position: "MID", wardScore: 6,
        },
      ],
      events: [],
      ...overrides,
    };
  }

  // ─── Bug 1: Player name mismatch ──────────────────────────────

  describe("bug 1: player name lookup matches event names", () => {
    it("detects player death when VictimName matches summonerName", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "ChampionKill", VictimName: "TestPlayer", KillerName: "EnemyTop" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("cuidado com"))).toBe(true);
    });

    it("detects enemy death and generates respawn window", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "ChampionKill", VictimName: "EnemyTop", KillerName: "TestPlayer" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "inimigo morreu: Aatrox")).toBe(true);
    });

    it("increments death counter on repeated player deaths", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      state.playerDeathCount = 2;
      const snapshot = makeSnapshot({
        events: [
          { EventName: "ChampionKill", VictimName: "TestPlayer", KillerName: "EnemyTop" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(state.playerDeathCount).toBe(3);
      expect(result.triggers.some((t) => t.includes("você morreu 3 vezes"))).toBe(true);
    });

    it("correctly identifies first blood as allied when recipient matches", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "FirstBlood", Recipient: "TestPlayer" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "first blood aliado")).toBe(true);
    });

    it("correctly identifies first blood as enemy when recipient is enemy", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "FirstBlood", Recipient: "EnemyTop" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "first blood inimigo")).toBe(true);
    });

    it("detects ally baron steal via player lookup", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "BaronKill", KillerName: "AllyJungle", Stolen: "True" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("roubamos barão"))).toBe(true);
    });

    it("detects enemy dragon steal via player lookup", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "DragonKill", KillerName: "EnemyMid", Stolen: "True", DragonType: "Fire" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("roubaram dragão"))).toBe(true);
    });
  });

  // ─── Bug 2: Dragon type ally vs enemy ─────────────────────────

  describe("bug 2: dragon type distinguishes ally vs enemy", () => {
    it("emits 'dragão tipo aliado' when ally kills dragon", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "dragão tipo aliado: Fire")).toBe(true);
      expect(result.triggers.some((t) => t.includes("inimigo"))).toBe(false);
    });

    it("emits 'dragão tipo inimigo' when enemy kills dragon", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Hextech", Stolen: "False" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "dragão tipo inimigo: Hextech")).toBe(true);
    });

    it("does not emit dragon type trigger for Elder dragon", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const snapshot = makeSnapshot({
        events: [
          { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Elder", Stolen: "False" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("dragão tipo"))).toBe(false);
    });
  });

  // ─── Bug 2 coach: fallback messages for dragon type ───────────

  describe("bug 2: coach fallback for ally vs enemy dragon type", () => {
    it("produces ally dragon message with 'pro time' phrasing", async () => {
      const configMod = await import("../src/core/config.js");
      const coachMod = await import("../src/core/coach.js");
      configMod.settings.zaiApiKey = "";
      configMod.settings.coachMessageMode = "serio";

      const result = await coachMod.decideCoaching(
        { activePlayerGold: 0, enemyPlayers: [] },
        ["dragão tipo aliado: Fire"],
        { objectiveStates: [] },
      );
      expect(result.skippedLlm).toBe(true);
      expect(result.message).toContain("fogo");
      expect(result.message).toContain("pro time");
    });

    it("produces enemy dragon message with enemy phrasing", async () => {
      const configMod = await import("../src/core/config.js");
      const coachMod = await import("../src/core/coach.js");
      configMod.settings.zaiApiKey = "";
      configMod.settings.coachMessageMode = "serio";

      const result = await coachMod.decideCoaching(
        { activePlayerGold: 0, enemyPlayers: [] },
        ["dragão tipo inimigo: Fire"],
        { objectiveStates: [] },
      );
      expect(result.skippedLlm).toBe(true);
      expect(result.message).toContain("fogo");
      expect(result.message).not.toContain("pro time");
    });

    it("detects correct category for ally and enemy dragon type", async () => {
      const coachMod = await import("../src/core/coach.js");
      expect(coachMod.detectCategory("dragão tipo aliado: Fire")).toBe("dragonTipo");
      expect(coachMod.detectCategory("dragão tipo inimigo: Hextech")).toBe("dragonTipoInimigo");
    });
  });

  // ─── Bug 3: Trigger urgency sort ──────────────────────────────

  describe("bug 3: sortTriggersByUrgency orders by urgency", () => {
    it("puts ace and nasceu agora before map reminders", async () => {
      const { sortTriggersByUrgency } = await import("../src/core/analyzer.js");
      const input = [
        "lembrete de mapa",
        "ace inimigo: barão",
        "dragão nasceu agora",
      ];
      const sorted = sortTriggersByUrgency(input);
      const aceIdx = sorted.indexOf("ace inimigo: barão");
      const dragonIdx = sorted.indexOf("dragão nasceu agora");
      const mapIdx = sorted.indexOf("lembrete de mapa");
      expect(aceIdx).toBeLessThan(mapIdx);
      expect(dragonIdx).toBeLessThan(mapIdx);
    });

    it("puts immediate objectives before strategic triggers", async () => {
      const { sortTriggersByUrgency } = await import("../src/core/analyzer.js");
      const input = [
        "cs alerta",
        "barão em 10 segundos",
        "lembrete de mapa",
      ];
      const sorted = sortTriggersByUrgency(input);
      expect(sorted[0]).toBe("barão em 10 segundos");
    });
  });

  // ─── Bug 4: Dragon soul cooldowns + Elder filter ──────────────

  describe("bug 4: dragon soul separate cooldowns and Elder filter", () => {
    it("allows ally and enemy soul warnings in the same window", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // 2 ally + 3 enemy dragons (each team close to soul)
      const events = [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Water", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Hextech", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Chemtech", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 1500 });
      const result = await analyzeSnapshot(snapshot, state);
      const hasAlly = result.triggers.some((t) => t.includes("alma do dragão aliada"));
      const hasEnemy = result.triggers.some((t) => t.includes("alma do dragão inimiga"));
      // Both should fire — separate cooldowns
      expect(hasAlly).toBe(true);
      expect(hasEnemy).toBe(true);
    });

    it("does not count Elder dragon toward soul threshold", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // 2 normal ally dragons + 1 Elder = should NOT trigger soul warning
      const events = [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Elder", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 2000 });
      const result = await analyzeSnapshot(snapshot, state);
      // Only 2 elemental dragons, soul needs 4, remaining=2, should fire falta 2
      expect(result.triggers.some((t) => t.includes("falta 2"))).toBe(true);
      // Verify the count is 2, not 3
      expect(state.allyDragonKills).toBe(2);
    });

    it("respects individual cooldown per team", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // Enemy has 3 dragons
      const events = [
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Water", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 1200 });
      await analyzeSnapshot(snapshot, state);

      // Enemy cooldown should be set, ally should still be 0
      expect(state.lastEnemyDragonSoulWarningAt).toBe(1200);
      expect(state.lastAllyDragonSoulWarningAt).toBe(0);
    });
  });

  // ─── Bug 5: inimigo fed uses simple trigger ───────────────────

  describe("bug 5: inimigo fed is a simple trigger (no LLM)", () => {
    it("skips LLM for inimigo fed trigger", async () => {
      const configMod = await import("../src/core/config.js");
      const coachMod = await import("../src/core/coach.js");
      configMod.settings.zaiApiKey = "test-key";
      configMod.settings.zaiEndpoint = "https://api.example/v1";
      configMod.settings.zaiModel = "gpt-4";
      configMod.settings.coachMessageMode = "serio";

      const result = await coachMod.decideCoaching(
        { activePlayerGold: 0, enemyPlayers: [] },
        ["inimigo fed: Aatrox"],
        { objectiveStates: [] },
      );
      expect(result.skippedLlm).toBe(true);
      expect(result.message).toContain("Aatrox");
    });

    it("fallback message includes champion name", async () => {
      const configMod = await import("../src/core/config.js");
      const coachMod = await import("../src/core/coach.js");
      configMod.settings.zaiApiKey = "";
      configMod.settings.coachMessageMode = "serio";

      const result = await coachMod.decideCoaching(
        { activePlayerGold: 0, enemyPlayers: [] },
        ["inimigo fed: Kai'Sa"],
        { objectiveStates: [] },
      );
      expect(result.message).toContain("Kai'Sa");
      expect(result.message.length).toBeGreaterThan(10);
    });
  });

  // ─── Bug 6: Objective timer deduplication ─────────────────────

  describe("bug 6: objective timers do not fire multiple times", () => {
    it("does not emit same objective threshold twice on consecutive ticks", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // First tick: dragon at 300s, gameTime at 232 → timeUntil=68, crosses 70 threshold
      state.lastAnalyzedGameTime = 228;
      const snapshot1 = makeSnapshot({ gameTime: 232, events: [] });
      const result1 = await analyzeSnapshot(snapshot1, state);
      const hasDragon1min = result1.triggers.some((t) => t.includes("dragão em 1 minuto"));
      expect(hasDragon1min).toBe(true);

      // Second tick: gameTime 237 — same threshold window
      const snapshot2 = makeSnapshot({ gameTime: 237, events: [] });
      const result2 = await analyzeSnapshot(snapshot2, state);
      const hasDragon1minAgain = result2.triggers.some((t) => t.includes("dragão em 1 minuto"));
      expect(hasDragon1minAgain).toBe(false);
    });
  });

  // ─── Bug 7: Event deduplication by EventID ────────────────────

  describe("bug 7: events are deduplicated by EventID", () => {
    it("does not process same EventID twice", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const events = [
        { EventID: 100, EventName: "ChampionKill", VictimName: "EnemyTop", KillerName: "TestPlayer" },
      ];
      const snapshot1 = makeSnapshot({ events });
      const result1 = await analyzeSnapshot(snapshot1, state);
      expect(result1.triggers.some((t) => t === "inimigo morreu: Aatrox")).toBe(true);

      // Same EventID appears again (simulating overlap)
      state.lastSeenEventCount = 0; // Reset to force re-reading events
      const snapshot2 = makeSnapshot({ events });
      const result2 = await analyzeSnapshot(snapshot2, state);
      // Should NOT generate the trigger again
      expect(result2.triggers.some((t) => t === "inimigo morreu: Aatrox")).toBe(false);
    });

    it("processes events without EventID normally", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // No EventID field
      const snapshot = makeSnapshot({
        events: [
          { EventName: "ChampionKill", VictimName: "EnemyTop", KillerName: "TestPlayer" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "inimigo morreu: Aatrox")).toBe(true);
    });
  });

  // ─── Bug 8: Enemy ult detection scoped to lane ────────────────

  describe("bug 8: enemy ult detection checks only lane opponent", () => {
    it("warns when lane opponent hits 6 before player", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      state.lastActiveLevel = 5;
      const snapshot = makeSnapshot({
        activePlayerLevel: 5,
        enemyPlayers: [
          {
            summonerName: "EnemyTop", championName: "Aatrox", level: 6,
            kills: 2, deaths: 0, assists: 1, creepScore: 50, currentGold: 800,
            items: [], position: "TOP", wardScore: 2,
          },
          {
            summonerName: "EnemyMid", championName: "Mel", level: 6,
            kills: 1, deaths: 1, assists: 0, creepScore: 40, currentGold: 600,
            items: [], position: "MID", wardScore: 3,
          },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      // Should only warn about Aatrox (TOP), not Mel (MID)
      expect(result.triggers.some((t) => t === "inimigo ult antes: Aatrox")).toBe(true);
      expect(result.triggers.some((t) => t.includes("Mel"))).toBe(false);
    });

    it("does not warn about enemy mid hitting 6 when player is top", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      state.lastActiveLevel = 5;
      const snapshot = makeSnapshot({
        activePlayerLevel: 5,
        activePlayerPosition: "TOP",
        enemyPlayers: [
          {
            summonerName: "EnemyTop", championName: "Aatrox", level: 5,
            kills: 1, deaths: 1, assists: 0, creepScore: 40, currentGold: 600,
            items: [], position: "TOP", wardScore: 2,
          },
          {
            summonerName: "EnemyMid", championName: "Mel", level: 6,
            kills: 3, deaths: 0, assists: 2, creepScore: 50, currentGold: 900,
            items: [], position: "MID", wardScore: 3,
          },
        ],
      });
      const result = await analyzeSnapshot(snapshot, state);
      // Mel is MID, player is TOP — should NOT trigger
      expect(result.triggers.some((t) => t.includes("inimigo ult antes"))).toBe(false);
    });
  });

  // ─── Bug 9: Grubs timer handles second wave ───────────────────

  describe("bug 9: grubs timer supports second wave", () => {
    it("returns respawn time after first wave killed", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // 3 grub kills (first wave), last at 540s, respawn = 540+120 = 660s
      // gameTime = 595 → timeUntil = 65, previousTimeUntil = 75 → crosses 70s threshold
      state.lastAnalyzedGameTime = 585;
      const events = [
        { EventName: "HordeKill", EventTime: 500 },
        { EventName: "HordeKill", EventTime: 520 },
        { EventName: "HordeKill", EventTime: 540 },
      ];
      const snapshot = makeSnapshot({ gameTime: 595, events });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("vastilarvas em 1 minuto"))).toBe(true);
    });

    it("returns null after all 6 grubs killed", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      state.lastAnalyzedGameTime = 750;
      const events = [
        { EventName: "HordeKill", EventTime: 500 },
        { EventName: "HordeKill", EventTime: 510 },
        { EventName: "HordeKill", EventTime: 520 },
        { EventName: "HordeKill", EventTime: 700 },
        { EventName: "HordeKill", EventTime: 710 },
        { EventName: "HordeKill", EventTime: 720 },
      ];
      const snapshot = makeSnapshot({ gameTime: 760, events });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t.includes("vastilarvas"))).toBe(false);
    });
  });

  // ─── Bug 10: Tower tier detection ─────────────────────────────

  describe("bug 10: tower triggers include tier", () => {
    it("includes T1 tier for outer tower", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const snapshot = makeSnapshot({
        events: [
          { EventName: "TurretKilled", TurretKilled: "Turret_TOrder_L2_P3_1509986696_0" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, makeState());
      expect(result.triggers.some((t) => t.includes("[T1]"))).toBe(true);
    });

    it("includes T2 tier for inner tower", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const snapshot = makeSnapshot({
        events: [
          { EventName: "TurretKilled", TurretKilled: "Turret_TChaos_L1_P2_1234567890_0" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, makeState());
      expect(result.triggers.some((t) => t.includes("[T2]"))).toBe(true);
    });

    it("includes T3 tier for inhib tower", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const snapshot = makeSnapshot({
        events: [
          { EventName: "TurretKilled", TurretKilled: "Turret_TOrder_L0_P1_9876543210_0" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, makeState());
      expect(result.triggers.some((t) => t.includes("[T3]"))).toBe(true);
    });

    it("includes nexus tier for nexus tower", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const snapshot = makeSnapshot({
        events: [
          { EventName: "TurretKilled", TurretKilled: "Turret_TOrder_C_05_A" },
        ],
      });
      const result = await analyzeSnapshot(snapshot, makeState());
      expect(result.triggers.some((t) => t.includes("[nexus]"))).toBe(true);
    });
  });

  // ─── Bug 3 + sorting: verify exported sort works ──────────────

  describe("bug 3: exported sortTriggersByUrgency", () => {
    it("is exported and callable", async () => {
      const { sortTriggersByUrgency } = await import("../src/core/analyzer.js");
      expect(typeof sortTriggersByUrgency).toBe("function");
    });

    it("keeps stable order for same-urgency triggers", async () => {
      const { sortTriggersByUrgency } = await import("../src/core/analyzer.js");
      const input = ["dragão nasceu agora", "ace inimigo: barão"];
      const sorted = sortTriggersByUrgency(input);
      // Both are urgency 0, order preserved
      expect(sorted).toEqual(["dragão nasceu agora", "ace inimigo: barão"]);
    });
  });

  // ─── Cross-bug integration: dragon attribution + soul count ───

  describe("integration: dragon kill attribution flows into soul count", () => {
    it("counts ally and enemy dragons correctly across mixed kills", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const events = [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "AllyJungle", DragonType: "Water", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyMid", DragonType: "Hextech", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 1500 });
      await analyzeSnapshot(snapshot, state);
      expect(state.allyDragonKills).toBe(2);
      expect(state.enemyDragonKills).toBe(2);
    });

    it("generates correct dragon type triggers for mixed kills", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      const events = [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Earth", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 800 });
      const result = await analyzeSnapshot(snapshot, state);
      expect(result.triggers.some((t) => t === "dragão tipo aliado: Fire")).toBe(true);
      expect(result.triggers.some((t) => t === "dragão tipo inimigo: Earth")).toBe(true);
    });

    it("ally dragon soul warning triggers at 3 ally kills, not total kills", async () => {
      const { analyzeSnapshot } = await import("../src/core/analyzer.js");
      const state = makeState();
      // 2 ally + 2 enemy = 4 total, but only 2 ally → remaining=2, triggers warning
      const events = [
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Fire", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Earth", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "TestPlayer", DragonType: "Water", Stolen: "False" },
        { EventName: "DragonKill", KillerName: "EnemyTop", DragonType: "Hextech", Stolen: "False" },
      ];
      const snapshot = makeSnapshot({ events, gameTime: 1500 });
      const result = await analyzeSnapshot(snapshot, state);
      // Ally has 2, remaining=2, should warn
      expect(result.triggers.some((t) => t.includes("alma do dragão aliada: falta 2"))).toBe(true);
      // Enemy also has 2, remaining=2, should warn too
      expect(result.triggers.some((t) => t.includes("alma do dragão inimiga: falta 2"))).toBe(true);
    });
  });
});

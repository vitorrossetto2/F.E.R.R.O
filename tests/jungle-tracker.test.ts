import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv/config", () => ({}));

const MOCK_JSON = {
  sections: {
    meta_junglers: {
      entries: [
        {
          champion: "Shaco",
          patch: "26.02",
          camps: 6,
          smites: 1,
          time: "02:39",
          path: "Red->Krugs->Raptors->Wolves->Gromp->Blue",
          path_steps: ["Red", "Krugs", "Raptors", "Wolves", "Gromp", "Blue"],
        },
        {
          champion: "Shaco",
          patch: "26.02",
          camps: 6,
          smites: 1,
          time: "02:45",
          path: "Blue->Gromp->Wolves->Raptors->Red->Krugs",
          path_steps: ["Blue", "Gromp", "Wolves", "Raptors", "Red", "Krugs"],
        },
        {
          champion: "Shaco",
          patch: "26.02",
          camps: 6,
          smites: 1,
          time: "02:50",
          path: "Red->Krugs->Raptors->Wolves->Gromp->Blue",
          path_steps: ["Red", "Krugs", "Raptors", "Wolves", "Gromp", "Blue"],
        },
        {
          champion: "Evelynn",
          patch: "26.02",
          camps: 6,
          smites: 2,
          time: "02:55",
          path: "Blue->Gromp->Wolves->Raptors->Red->Krugs",
          path_steps: ["Blue", "Gromp", "Wolves", "Raptors", "Red", "Krugs"],
        },
      ],
    },
    off_meta_junglers: { entries: [] },
    non_meta_junglers: { entries: [] },
  },
};

describe("jungle-tracker", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("loadJungleProfiles", () => {
    it("parses JSON and returns Map with fastest clear time per champion", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles } = await import("../src/core/jungle-tracker.js");
      const profiles = loadJungleProfiles();

      expect(profiles.size).toBe(2);

      const shaco = profiles.get("Shaco")!;
      expect(shaco.championName).toBe("Shaco");
      expect(shaco.fastestClearTime).toBe(159); // 2:39 = 159s
      expect(shaco.mostCommonStartSide).toBe("red"); // 2 of 3 start Red-side
      expect(shaco.mostCommonPath).toEqual(["Red", "Krugs", "Raptors", "Wolves", "Gromp", "Blue"]);

      const eve = profiles.get("Evelynn")!;
      expect(eve.fastestClearTime).toBe(175); // 2:55 = 175s
      expect(eve.mostCommonStartSide).toBe("blue");
    });

    it("returns empty map when JSON file is missing", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => { throw new Error("ENOENT"); },
      }));

      const { loadJungleProfiles } = await import("../src/core/jungle-tracker.js");
      const profiles = loadJungleProfiles();

      expect(profiles.size).toBe(0);
    });
  });

  function makeSnapshot(overrides: Record<string, unknown> = {}) {
    return {
      gameTime: 200,
      activePlayerName: "TestPlayer",
      activePlayerChampion: "Jax",
      activePlayerLevel: 3,
      activePlayerGold: 1000,
      activePlayerTeam: "CHAOS",
      activePlayerKda: "0/0/0",
      activePlayerIsDead: false,
      activePlayerPosition: "TOP",
      activePlayerRespawnTimer: 0,
      alliedPlayers: [
        {
          summonerName: "TestPlayer",
          championName: "Jax",
          level: 3,
          kills: 0,
          deaths: 0,
          assists: 0,
          creepScore: 30,
          currentGold: 1000,
          items: [],
          position: "TOP",
          wardScore: 0,
        },
      ],
      enemyPlayers: [
        {
          summonerName: "EnemyJg",
          championName: "Shaco",
          level: 3,
          kills: 0,
          deaths: 0,
          assists: 0,
          creepScore: 20,
          currentGold: 800,
          items: [],
          position: "JUNGLE",
          wardScore: 0,
        },
      ],
      events: [],
      ...overrides,
    };
  }

  function makePlayerLookup(snapshot: ReturnType<typeof makeSnapshot>) {
    const lookup = new Map();
    for (const p of [...snapshot.alliedPlayers, ...snapshot.enemyPlayers]) {
      lookup.set(p.summonerName, p);
    }
    return lookup;
  }

  describe("collectJungleTimingTriggers", () => {
    it("emits defensive alert for laner when first clear window is reached", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      // Shaco fastest clear = 159s + 20s walk = 179s. gameTime = 200 > 179 → trigger
      const snapshot = makeSnapshot({ gameTime: 200 });

      const triggers = collectJungleTimingTriggers(snapshot, [], makePlayerLookup(snapshot), profiles);

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("gank timing:");
      expect(triggers[0]).toContain("caçador inimigo pode atacar");
      // Shaco most common start = red → gank top/mid. Player is TOP → alert top
      expect(triggers[0]).toContain("top");
    });

    it("emits offensive alert for jungler during enemy first clear", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      // gameTime = 100 → within first clear (90 < 100 < 179) → offensive alert
      const snapshot = makeSnapshot({
        gameTime: 100,
        activePlayerPosition: "JUNGLE",
      });

      const triggers = collectJungleTimingTriggers(snapshot, [], makePlayerLookup(snapshot), profiles);

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("caçador inimigo está limpando a selva");
      // Shaco starts red → jungler should attack opposite side → bot
      expect(triggers[0]).toContain("bot");
    });

    it("does not alert before camps spawn (< 90s)", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      const snapshot = makeSnapshot({ gameTime: 60 });

      const triggers = collectJungleTimingTriggers(snapshot, [], makePlayerLookup(snapshot), profiles);

      expect(triggers).toEqual([]);
    });

    it("does not repeat first clear alert", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      const snapshot = makeSnapshot({ gameTime: 200 });
      const lookup = makePlayerLookup(snapshot);

      const first = collectJungleTimingTriggers(snapshot, [], lookup, profiles);
      expect(first.length).toBe(1);

      const second = collectJungleTimingTriggers(snapshot, [], lookup, profiles);
      expect(second).toEqual([]);
    });

    it("returns nothing when enemy jungler is not in profiles", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      const snapshot = makeSnapshot({
        gameTime: 200,
        enemyPlayers: [
          {
            summonerName: "EnemyJg",
            championName: "UnknownChamp",
            level: 3,
            kills: 0,
            deaths: 0,
            assists: 0,
            creepScore: 20,
            currentGold: 800,
            items: [],
            position: "JUNGLE",
            wardScore: 0,
          },
        ],
      });

      const triggers = collectJungleTimingTriggers(snapshot, [], makePlayerLookup(snapshot), profiles);

      expect(triggers).toEqual([]);
    });

    it("emits second rotation alert for laner", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      // Shaco clear = 159s. Second rotation = (159*2)+40 = 358s
      const snapshot1 = makeSnapshot({ gameTime: 200 });
      const lookup = makePlayerLookup(snapshot1);

      // Consume first alert
      collectJungleTimingTriggers(snapshot1, [], lookup, profiles);

      // Trigger second rotation
      const snapshot2 = makeSnapshot({ gameTime: 360 });
      const triggers = collectJungleTimingTriggers(snapshot2, [], makePlayerLookup(snapshot2), profiles);

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("segunda rotação do caçador");
    });

    it("emits second rotation offensive alert for jungler", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      // Shaco clear = 159s. Jungler offensive window = 159+40=199 to (159*2)+40=358
      const snapshot1 = makeSnapshot({ gameTime: 100, activePlayerPosition: "JUNGLE" });
      const lookup = makePlayerLookup(snapshot1);

      // Consume first alert
      collectJungleTimingTriggers(snapshot1, [], lookup, profiles);

      const snapshot2 = makeSnapshot({ gameTime: 210, activePlayerPosition: "JUNGLE" });
      const triggers = collectJungleTimingTriggers(snapshot2, [], makePlayerLookup(snapshot2), profiles);

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("segunda rotação");
      expect(triggers[0]).toContain("pressionar");
    });

    it("emits post-death alert when enemy jungler dies", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      // First, advance past first clear to consume that alert
      const snapshot1 = makeSnapshot({ gameTime: 200 });
      collectJungleTimingTriggers(snapshot1, [], makePlayerLookup(snapshot1), profiles);

      // Now simulate jungler death event
      const deathEvent = {
        EventName: "ChampionKill",
        EventID: 5,
        EventTime: 300,
        KillerName: "TestPlayer",
        VictimName: "EnemyJg",
      };
      const snapshot2 = makeSnapshot({ gameTime: 300 });
      const triggers = collectJungleTimingTriggers(
        snapshot2,
        [deathEvent],
        makePlayerLookup(snapshot2),
        profiles
      );

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("caçador inimigo morreu");
    });

    it("emits offensive post-death alert for jungler player", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      const snapshot1 = makeSnapshot({ gameTime: 100, activePlayerPosition: "JUNGLE" });
      collectJungleTimingTriggers(snapshot1, [], makePlayerLookup(snapshot1), profiles);

      const deathEvent = {
        EventName: "ChampionKill",
        EventID: 5,
        EventTime: 300,
        KillerName: "TestPlayer",
        VictimName: "EnemyJg",
      };
      const snapshot2 = makeSnapshot({ gameTime: 300, activePlayerPosition: "JUNGLE" });
      const triggers = collectJungleTimingTriggers(
        snapshot2,
        [deathEvent],
        makePlayerLookup(snapshot2),
        profiles
      );

      expect(triggers.length).toBe(1);
      expect(triggers[0]).toContain("aproveita para atacar");
    });

    it("does not emit alerts after 10 minutes", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers } = await import(
        "../src/core/jungle-tracker.js"
      );
      const profiles = loadJungleProfiles();
      const snapshot = makeSnapshot({ gameTime: 650 });

      const triggers = collectJungleTimingTriggers(snapshot, [], makePlayerLookup(snapshot), profiles);

      expect(triggers).toEqual([]);
    });

    it("resets state between games via resetJungleTrackingState", async () => {
      vi.doMock("fs", () => ({
        readFileSync: () => JSON.stringify(MOCK_JSON),
      }));

      const { loadJungleProfiles, collectJungleTimingTriggers, resetJungleTrackingState } =
        await import("../src/core/jungle-tracker.js");
      const profiles = loadJungleProfiles();
      const snapshot = makeSnapshot({ gameTime: 200 });
      const lookup = makePlayerLookup(snapshot);

      // Consume first alert
      const first = collectJungleTimingTriggers(snapshot, [], lookup, profiles);
      expect(first.length).toBe(1);

      // Reset
      resetJungleTrackingState();

      // Should trigger again
      const afterReset = collectJungleTimingTriggers(snapshot, [], lookup, profiles);
      expect(afterReset.length).toBe(1);
    });
  });
});

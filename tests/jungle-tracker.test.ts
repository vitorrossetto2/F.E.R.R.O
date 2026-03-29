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
});

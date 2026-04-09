import { describe, expect, it } from "vitest";
import {
  buildImpactFactors,
  buildTips,
  localizeText,
} from "../src/renderer/features/match-analysis/index.js";
import type { MatchData } from "../src/renderer/features/match-analysis/index.js";

const sampleData: MatchData = {
  sessionInfo: { duration: 1500, gameMode: "CLASSIC", mapName: "Map11" },
  teams: {
    ORDER: { kills: 20, deaths: 10, assists: 30, cs: 800, averageLevel: 15 },
    CHAOS: { kills: 10, deaths: 20, assists: 15, cs: 650, averageLevel: 13 },
  },
  players: {},
  objectives: {
    dragons: { ORDER: 3, CHAOS: 1 },
    barons: { ORDER: 1, CHAOS: 0 },
    towers: { ORDER: 8, CHAOS: 3 },
    inhibitors: { ORDER: 1, CHAOS: 0 },
  },
  events: [],
  insights: [],
  charts: {
    gold: [
      { time: 300, clock: "5:00", value: 500 },
      { time: 900, clock: "15:00", value: 750 },
    ],
    level: [],
    killLead: [],
  },
  itemTimeline: [{ time: 600, clock: "10:00", added: ["Item"], removed: [] }],
  activePlayerChampion: "Jinx",
  activePlayerName: "Player",
  activePlayerTeam: "ORDER",
  activePlayerStats: {
    kills: 8,
    deaths: 2,
    assists: 10,
    creepScore: 180,
    level: 16,
  },
};

describe("match analysis feature helpers", () => {
  it("localizes analyzer strings", () => {
    const text = localizeText("ORDER secured Baron after First blood");
    expect(text).toContain("Time Azul");
    expect(text).toContain("Bar");
    expect(text).toContain("Primeiro abate");
  });

  it("builds next-game tips from normalized data", () => {
    const tips = buildTips(sampleData);
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0]).toContain("ponto mais forte");
  });

  it("derives impact factors for a winning game", () => {
    const factors = buildImpactFactors(sampleData, "vitoria");
    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0]?.level).toBe("alto");
  });
});

import { describe, expect, it } from "vitest";
import { normalizeMatchData } from "../src/renderer/pages/MatchAnalysis.tsx";

describe("MatchAnalysis data normalization", () => {
  it("maps analyzer payloads to the page shape", () => {
    const normalized = normalizeMatchData({
      meta: {
        durationSeconds: 438,
        gameMode: "PRACTICETOOL",
        activeChampion: "Alistar",
        activeTeam: "ORDER",
      },
      finalFrame: {
        activePlayer: {
          championName: "Alistar",
          team: "ORDER",
          kills: 0,
          deaths: 3,
          assists: 0,
          cs: 30,
        },
        teams: {
          ORDER: {
            totals: { kills: 5, deaths: 5, assists: 3, cs: 100, averageLevel: 5.4 },
            players: [
              {
                summonerName: "Mickael#XD1",
                championName: "Alistar",
                kills: 0,
                deaths: 3,
                assists: 0,
                cs: 30,
                level: 6,
                items: ["Botas"],
                killParticipation: 0,
                team: "ORDER",
              },
            ],
          },
          CHAOS: {
            totals: { kills: 5, deaths: 5, assists: 7, cs: 120, averageLevel: 5.6 },
            players: [
              {
                summonerName: "Ashe Bot",
                championName: "Ashe",
                kills: 2,
                deaths: 0,
                assists: 1,
                cs: 40,
                level: 6,
                items: ["Arco"],
                killParticipation: 60,
                team: "CHAOS",
              },
            ],
          },
        },
      },
      objectives: {
        dragonsByTeam: { ORDER: 1, CHAOS: 0 },
        baronsByTeam: { ORDER: 0, CHAOS: 0 },
        towersByTeam: { ORDER: 2, CHAOS: 1 },
        inhibsByTeam: { ORDER: 0, CHAOS: 0 },
      },
      events: [
        { category: "kill", time: 94.88, label: "Ashe eliminou Alistar", team: "CHAOS" },
      ],
      insights: ["First blood saiu em 01:21"],
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.sessionInfo.duration).toBe(438);
    expect(normalized?.activePlayerChampion).toBe("Alistar");
    expect(normalized?.activePlayerStats).toEqual({ kills: 0, deaths: 3, assists: 0, creepScore: 30 });
    expect(normalized?.objectives.dragons.ORDER).toBe(1);
    expect(normalized?.events[0]).toEqual({
      type: "kill",
      time: 94.88,
      description: "Ashe eliminou Alistar",
      team: "CHAOS",
    });
    expect(normalized?.players.ORDER["Mickael#XD1"]?.championName).toBe("Alistar");
    expect(normalized?.insights[0]).toEqual({ label: "Insight", value: "First blood saiu em 01:21" });
  });

  it("keeps the legacy match payload shape intact", () => {
    const legacy = {
      sessionInfo: { duration: 1200, gameMode: "CLASSIC" },
      teams: { ORDER: { kills: 10, deaths: 8, assists: 20, cs: 700, averageLevel: 14 } },
      players: {},
      objectives: { dragons: { ORDER: 2 }, barons: {}, towers: {}, inhibitors: {} },
      events: [],
      insights: [],
      activePlayerChampion: "Teemo",
      activePlayerTeam: "ORDER",
    };

    expect(normalizeMatchData(legacy)).toBe(legacy);
  });
});

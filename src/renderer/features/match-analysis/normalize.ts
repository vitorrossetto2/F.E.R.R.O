import { formatClock, localizeText, safeNumber } from "./formatters";
import type { InsightEntry, MatchData, RawMatchAnalysis } from "./types";

function isMatchData(value: unknown): value is MatchData {
  return Boolean(value) && typeof value === "object" && "sessionInfo" in (value as Record<string, unknown>);
}

export function normalizeMatchData(payload: unknown): MatchData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (isMatchData(payload)) {
    return payload;
  }

  const raw = payload as RawMatchAnalysis;
  const activePlayer = raw.finalFrame?.activePlayer;
  const rawTeams = raw.finalFrame?.teams ?? {};

  const teams = Object.fromEntries(
    Object.entries(rawTeams).map(([teamCode, teamData]) => [
      teamCode,
      {
        kills: safeNumber(teamData?.totals?.kills),
        deaths: safeNumber(teamData?.totals?.deaths),
        assists: safeNumber(teamData?.totals?.assists),
        cs: safeNumber(teamData?.totals?.cs),
        averageLevel: safeNumber(teamData?.totals?.averageLevel),
      },
    ])
  );

  const players = Object.fromEntries(
    Object.entries(rawTeams).map(([teamCode, teamData]) => [
      teamCode,
      Object.fromEntries(
        (teamData?.players ?? []).map((player, index) => [
          player.summonerName || `${player.championName || "player"}-${index}`,
          {
            championName: player.championName ?? "Desconhecido",
            kills: safeNumber(player.kills),
            deaths: safeNumber(player.deaths),
            assists: safeNumber(player.assists),
            creepScore: safeNumber(player.cs ?? player.creepScore),
            level: safeNumber(player.level),
            items: Array.isArray(player.items) ? player.items : [],
            killParticipation: safeNumber(player.killParticipation),
            team: player.team ?? teamCode,
          },
        ])
      ),
    ])
  );

  const insights = (raw.insights ?? [])
    .map((entry) => {
      if (typeof entry === "string") {
        return { label: "Leitura", value: localizeText(entry) };
      }

      if (!entry) {
        return null;
      }

      return {
        label: entry.label ?? "Leitura",
        value: localizeText(entry.value ?? ""),
      };
    })
    .filter((entry): entry is InsightEntry => Boolean(entry?.value));

  return {
    sessionInfo: {
      duration: safeNumber(raw.meta?.durationSeconds),
      gameMode: raw.meta?.gameMode ?? "Desconhecido",
      mapName: raw.meta?.mapName,
    },
    overview: raw.overview
      ? {
          totalKills: safeNumber(raw.overview.totalKills),
          firstBloodAt: safeNumber(raw.overview.firstBloodAt),
          bloodiestMinute: raw.overview.bloodiestMinute
            ? {
                label: raw.overview.bloodiestMinute.label ?? "-",
                kills: safeNumber(raw.overview.bloodiestMinute.kills),
              }
            : undefined,
          biggestMultikill: raw.overview.biggestMultikill
            ? {
                size: safeNumber(raw.overview.biggestMultikill.size),
                clock: raw.overview.biggestMultikill.clock ?? "-",
                player: raw.overview.biggestMultikill.player ?? "Desconhecido",
              }
            : null,
        }
      : undefined,
    teams,
    players,
    objectives: {
      dragons: raw.objectives?.dragonsByTeam ?? {},
      barons: raw.objectives?.baronsByTeam ?? {},
      towers: raw.objectives?.towersByTeam ?? {},
      inhibitors: raw.objectives?.inhibsByTeam ?? {},
    },
    events: (raw.events ?? []).map((event) => ({
      type: event.type ?? event.category ?? "macro",
      category: event.category ?? event.type ?? "macro",
      time: safeNumber(event.time),
      clock: event.clock ?? formatClock(safeNumber(event.time)),
      description: event.label ?? event.description ?? "",
      team: event.team,
    })),
    insights,
    charts: {
      gold: (raw.charts?.gold ?? []).map((point) => ({
        time: safeNumber(point.time),
        clock: point.clock ?? formatClock(safeNumber(point.time)),
        value: safeNumber(point.value),
      })),
      level: (raw.charts?.level ?? []).map((point) => ({
        time: safeNumber(point.time),
        clock: point.clock ?? formatClock(safeNumber(point.time)),
        value: safeNumber(point.value),
      })),
      killLead: (raw.charts?.killLead ?? []).map((point) => ({
        time: safeNumber(point.time),
        clock: point.clock ?? formatClock(safeNumber(point.time)),
        activeTeamKills: safeNumber(point.activeTeamKills),
        enemyTeamKills: safeNumber(point.enemyTeamKills),
        lead: safeNumber(point.lead),
      })),
    },
    itemTimeline: (raw.itemTimeline ?? []).map((entry) => ({
      time: safeNumber(entry.time),
      clock: entry.clock ?? formatClock(safeNumber(entry.time)),
      added: Array.isArray(entry.added) ? entry.added : [],
      removed: Array.isArray(entry.removed) ? entry.removed : [],
    })),
    activePlayerChampion: raw.meta?.activeChampion ?? activePlayer?.championName,
    activePlayerName: raw.meta?.activePlayerName,
    activePlayerTeam: raw.meta?.activeTeam ?? activePlayer?.team,
    activePlayerStats: activePlayer
      ? {
          kills: safeNumber(activePlayer.kills),
          deaths: safeNumber(activePlayer.deaths),
          assists: safeNumber(activePlayer.assists),
          creepScore: safeNumber(activePlayer.cs ?? activePlayer.creepScore),
          level: safeNumber(activePlayer.level),
        }
      : undefined,
  };
}

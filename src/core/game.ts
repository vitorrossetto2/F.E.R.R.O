import https from "node:https";

import axios, { type AxiosError } from "axios";

import { settings } from "./config";
import type { CompactItem, GameSnapshot, LoggerPayload, SnapshotPlayer } from "./types";

const liveClient = axios.create({
  baseURL: settings.liveClientBaseUrl,
  timeout: 2000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

function stripRiotTag(name: string): string {
  const idx = name.indexOf("#");
  return idx > 0 ? name.slice(0, idx) : name;
}

function compactPlayer(player: any): SnapshotPlayer {
  const scores = player?.scores ?? {};
  const items = Array.isArray(player?.items) ? player.items : [];

  return {
    summonerName: player?.riotIdGameName ?? stripRiotTag(player?.summonerName ?? ""),
    championName: player?.championName ?? "Unknown",
    level: Number(player?.level ?? 0),
    kills: Number(scores.kills ?? 0),
    deaths: Number(scores.deaths ?? 0),
    assists: Number(scores.assists ?? 0),
    creepScore: Number(scores.creepScore ?? 0),
    currentGold: Number(player?.currentGold ?? 0),
    items: items
      .map((item: any): CompactItem => ({
        id: Number(item?.itemID ?? 0),
        name: item?.displayName ?? ""
      }))
      .filter((item: CompactItem) => item.name.length > 0),
    position: player?.position ?? "UNKNOWN",
    wardScore: Number(scores.wardScore ?? 0)
  };
}

export async function getSnapshot(
  logGame?: (type: string, payload?: LoggerPayload) => Promise<void>
): Promise<GameSnapshot | null> {
  try {
    const response = await liveClient.get("/liveclientdata/allgamedata");
    const allGameData = (response.data ?? {}) as Record<string, any>;

    if (logGame) {
      const gameTime = Number(allGameData?.gameData?.gameTime ?? 0);
      await logGame("api_response", { gameTime, data: allGameData });
    }

    const activePlayer = allGameData.activePlayer ?? {};
    const activePlayerName = stripRiotTag(activePlayer.summonerName ?? "");
    const allPlayers = Array.isArray(allGameData.allPlayers) ? allGameData.allPlayers : [];
    const currentPlayer =
      allPlayers.find((player: any) => {
        const name = player?.riotIdGameName ?? stripRiotTag(player?.summonerName ?? "");
        return name === activePlayerName;
      }) ?? {};
    const currentTeam = currentPlayer.team;
    const events = Array.isArray(allGameData?.events?.Events) ? allGameData.events.Events : [];
    const currentScores = currentPlayer.scores ?? {};

    return {
      gameTime: Number(allGameData?.gameData?.gameTime ?? 0),
      activePlayerName,
      activePlayerChampion: currentPlayer.championName ?? "Unknown",
      activePlayerLevel: Number(currentPlayer.level ?? 0),
      activePlayerIsDead: Boolean(currentPlayer.isDead),
      activePlayerRespawnTimer: Number(currentPlayer.respawnTimer ?? 0),
      activePlayerGold: Number(activePlayer.currentGold ?? 0),
      activePlayerTeam: currentTeam ?? "ORDER",
      activePlayerKda: `${currentScores.kills ?? 0}/${currentScores.deaths ?? 0}/${currentScores.assists ?? 0}`,
      activePlayerPosition: currentPlayer.position ?? "UNKNOWN",
      alliedPlayers: allPlayers
        .filter((player: any) => player?.team === currentTeam)
        .map(compactPlayer),
      enemyPlayers: allPlayers
        .filter((player: any) => player?.team && player.team !== currentTeam)
        .map(compactPlayer),
      events
    };
  } catch (error) {
    const err = error as AxiosError;
    if (err.code !== "ECONNREFUSED" && err.response?.status !== 404) {
      console.error("[Game] Erro ao buscar snapshot:", err.message);
    }
    return null;
  }
}

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SessionSummary } from "../shared/types";

export interface SessionAnalysis {
  [key: string]: unknown;
}

type TeamCode = "ORDER" | "CHAOS";
type TeamStats = Record<TeamCode, number>;
type RawEntry = Record<string, any>;
type SnapshotEntry = {
  ts: string;
  sessionId: string;
  gameTime: number;
  data: Record<string, any>;
};
type TimelineItem = { itemID: number; displayName: string };

const cache = new Map<string, { cacheKey: string; analysis: SessionAnalysis }>();

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClock(totalSeconds: unknown): string {
  const value = Math.max(0, Math.floor(safeNumber(totalSeconds)));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseJsonLines(rawText: string): RawEntry[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeSnapshots(entries: RawEntry[]): SnapshotEntry[] {
  return entries
    .filter((entry) => entry.type === "api_response" && entry.data?.gameData && Array.isArray(entry.data?.allPlayers))
    .map((entry) => ({
      ts: entry.ts,
      sessionId: entry.sessionId,
      gameTime: safeNumber(entry.gameTime ?? entry.data?.gameData?.gameTime),
      data: entry.data
    }))
    .sort((left, right) => left.gameTime - right.gameTime);
}

function dedupeEvents(events: RawEntry[]): RawEntry[] {
  const seen = new Set<string>();
  const result: RawEntry[] = [];

  for (const event of events) {
    if (!event || typeof event !== "object") continue;

    const key = event.EventID !== undefined
      ? `id:${event.EventID}`
      : [
          event.EventName,
          safeNumber(event.EventTime),
          event.KillerName,
          event.VictimName,
          event.TurretKilled,
          event.InhibKilled
        ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }

  return result.sort((left, right) => safeNumber(left.EventTime) - safeNumber(right.EventTime));
}

function buildPlayerLookup(players: RawEntry[]): Map<string, RawEntry> {
  const lookup = new Map<string, RawEntry>();

  for (const player of players) {
    const keys = [
      player?.summonerName,
      player?.riotId,
      player?.riotIdGameName,
      player?.championName
    ].filter(Boolean);

    for (const key of keys) {
      lookup.set(key, player);
      if (typeof key === "string" && key.includes("#")) {
        lookup.set(key.split("#")[0], player);
      }
    }
  }

  return lookup;
}

function getStructureOwner(structureName: unknown): TeamCode | null {
  const name = String(structureName ?? "").toUpperCase();
  if (name.includes("TORDER")) return "ORDER";
  if (name.includes("TCHAOS")) return "CHAOS";
  return null;
}

function getOppositeTeam(team: TeamCode | null): TeamCode | null {
  if (team === "ORDER") return "CHAOS";
  if (team === "CHAOS") return "ORDER";
  return null;
}

function createEmptyTeamStats(): TeamStats {
  return {
    ORDER: 0,
    CHAOS: 0
  };
}

function groupPlayersByTeam(players: RawEntry[]): Record<TeamCode, RawEntry[]> {
  return {
    ORDER: players.filter((player) => player.team === "ORDER"),
    CHAOS: players.filter((player) => player.team === "CHAOS")
  };
}

function summarizeTeam(players: RawEntry[]) {
  return {
    kills: players.reduce((sum, player) => sum + safeNumber(player?.scores?.kills), 0),
    deaths: players.reduce((sum, player) => sum + safeNumber(player?.scores?.deaths), 0),
    assists: players.reduce((sum, player) => sum + safeNumber(player?.scores?.assists), 0),
    cs: players.reduce((sum, player) => sum + safeNumber(player?.scores?.creepScore), 0),
    wards: Math.round(players.reduce((sum, player) => sum + safeNumber(player?.scores?.wardScore), 0) * 10) / 10,
    averageLevel:
      players.length === 0
        ? 0
        : Math.round((players.reduce((sum, player) => sum + safeNumber(player?.level), 0) / players.length) * 10) / 10
  };
}

function getPlayerKillParticipation(player: RawEntry, teamKills: number): number {
  if (!teamKills) return 0;
  const scores = player?.scores ?? {};
  return Math.round((((safeNumber(scores.kills) + safeNumber(scores.assists)) / teamKills) * 100) * 10) / 10;
}

function buildPlayerSummary(player: RawEntry, teamKills: number) {
  const scores = player?.scores ?? {};
  return {
    summonerName: player?.summonerName ?? "",
    riotIdGameName: player?.riotIdGameName ?? "",
    championName: player?.championName ?? "Unknown",
    team: player?.team ?? "UNKNOWN",
    position: player?.position ?? "UNKNOWN",
    level: safeNumber(player?.level),
    kills: safeNumber(scores.kills),
    deaths: safeNumber(scores.deaths),
    assists: safeNumber(scores.assists),
    cs: safeNumber(scores.creepScore),
    wardScore: Math.round(safeNumber(scores.wardScore) * 10) / 10,
    isDead: Boolean(player?.isDead),
    killParticipation: getPlayerKillParticipation(player, teamKills),
    items: Array.isArray(player?.items)
      ? player.items
          .filter((item) => safeNumber(item?.slot) < 6)
          .map((item) => item?.displayName)
          .filter(Boolean)
      : []
  };
}

function buildItemTimeline(snapshots: SnapshotEntry[], activePlayerName: string) {
  const timeline: Array<{ time: number; clock: string; added: string[]; removed: string[] }> = [];
  let previousItems: TimelineItem[] = [];

  for (const snapshot of snapshots) {
    const player = snapshot.data.allPlayers.find((entry: RawEntry) => entry?.summonerName === activePlayerName);
    if (!player) continue;

    const currentItems: TimelineItem[] = (player.items ?? [])
      .filter((item: RawEntry) => safeNumber(item?.slot) < 6)
      .map((item: RawEntry): TimelineItem => ({
        itemID: safeNumber(item?.itemID),
        displayName: item?.displayName ?? ""
      }))
      .filter((item: TimelineItem) => item.displayName.length > 0);

    const currentIds = new Set(currentItems.map((item: TimelineItem) => item.itemID));
    const previousIds = new Set(previousItems.map((item: TimelineItem) => item.itemID));

    const added = currentItems
      .filter((item: TimelineItem) => !previousIds.has(item.itemID))
      .map((item: TimelineItem) => item.displayName);

    const removed = previousItems
      .filter((item: TimelineItem) => !currentIds.has(item.itemID))
      .map((item: TimelineItem) => item.displayName);

    if (added.length > 0 || removed.length > 0) {
      timeline.push({
        time: snapshot.gameTime,
        clock: formatClock(snapshot.gameTime),
        added,
        removed
      });
    }

    previousItems = currentItems;
  }

  return timeline;
}

function buildObjectiveSummary(events: RawEntry[], playerLookup: Map<string, RawEntry>) {
  const summary: any = {
    dragonsByTeam: createEmptyTeamStats(),
    dragonTypes: [],
    baronsByTeam: createEmptyTeamStats(),
    heraldsByTeam: createEmptyTeamStats(),
    grubsByTeam: createEmptyTeamStats(),
    towersByTeam: createEmptyTeamStats(),
    inhibsByTeam: createEmptyTeamStats(),
    stolenObjectives: []
  };

  for (const event of events) {
    const eventName = event?.EventName;
    const killer = playerLookup.get(event?.KillerName);
    const killerTeam = (killer?.team ?? null) as TeamCode | null;

    if (eventName === "DragonKill" && killerTeam) {
      summary.dragonsByTeam[killerTeam] += 1;
      summary.dragonTypes.push({
        time: safeNumber(event.EventTime),
        clock: formatClock(event.EventTime),
        team: killerTeam,
        dragonType: event?.DragonType ?? "Unknown",
        stolen: String(event?.Stolen) === "True"
      });
      if (String(event?.Stolen) === "True") {
        summary.stolenObjectives.push({
          time: safeNumber(event.EventTime),
          clock: formatClock(event.EventTime),
          label: `${killer?.championName ?? event?.KillerName} roubou dragon ${event?.DragonType ?? ""}`.trim()
        });
      }
    }

    if (eventName === "BaronKill" && killerTeam) {
      summary.baronsByTeam[killerTeam] += 1;
      if (String(event?.Stolen) === "True") {
        summary.stolenObjectives.push({
          time: safeNumber(event.EventTime),
          clock: formatClock(event.EventTime),
          label: `${killer?.championName ?? event?.KillerName} roubou Baron`
        });
      }
    }

    if ((eventName === "HeraldKill" || eventName === "RiftHeraldKill") && killerTeam) {
      summary.heraldsByTeam[killerTeam] += 1;
    }

    if ((eventName === "HordeKill" || eventName === "VoidGrubKill") && killerTeam) {
      summary.grubsByTeam[killerTeam] += 1;
    }

    if (eventName === "TurretKilled") {
      const structureOwner = getStructureOwner(event?.TurretKilled);
      const creditedTeam = getOppositeTeam(structureOwner);
      if (creditedTeam) summary.towersByTeam[creditedTeam] += 1;
    }

    if (eventName === "InhibKilled") {
      const structureOwner = getStructureOwner(event?.InhibKilled);
      const creditedTeam = getOppositeTeam(structureOwner);
      if (creditedTeam) summary.inhibsByTeam[creditedTeam] += 1;
    }
  }

  return summary;
}

function sampleSnapshots(snapshots: SnapshotEntry[], intervalSeconds = 30): SnapshotEntry[] {
  const samples: SnapshotEntry[] = [];
  let nextTime = 0;

  for (const snapshot of snapshots) {
    if (samples.length === 0 || snapshot.gameTime >= nextTime) {
      samples.push(snapshot);
      nextTime = snapshot.gameTime + intervalSeconds;
    }
  }

  const lastSnapshot = snapshots[snapshots.length - 1];
  if (lastSnapshot && samples[samples.length - 1] !== lastSnapshot) {
    samples.push(lastSnapshot);
  }

  return samples;
}

function buildKillLeadSeries(
  sampledSnapshots: SnapshotEntry[],
  events: RawEntry[],
  playerLookup: Map<string, RawEntry>,
  activeTeam: TeamCode
) {
  const points: Array<{ time: number; clock: string; activeTeamKills: number; enemyTeamKills: number; lead: number }> = [];
  let eventIndex = 0;
  let orderKills = 0;
  let chaosKills = 0;
  const championKillEvents = events.filter((event) => event?.EventName === "ChampionKill");

  for (const snapshot of sampledSnapshots) {
    while (eventIndex < championKillEvents.length && safeNumber(championKillEvents[eventIndex].EventTime) <= snapshot.gameTime) {
      const event = championKillEvents[eventIndex];
      const killerTeam = playerLookup.get(event?.KillerName)?.team;
      if (killerTeam === "ORDER") orderKills += 1;
      if (killerTeam === "CHAOS") chaosKills += 1;
      eventIndex += 1;
    }

    const activeKills = activeTeam === "ORDER" ? orderKills : chaosKills;
    const enemyKills = activeTeam === "ORDER" ? chaosKills : orderKills;

    points.push({
      time: snapshot.gameTime,
      clock: formatClock(snapshot.gameTime),
      activeTeamKills: activeKills,
      enemyTeamKills: enemyKills,
      lead: activeKills - enemyKills
    });
  }

  return points;
}

function buildGoldSeries(sampledSnapshots: SnapshotEntry[]) {
  return sampledSnapshots.map((snapshot) => ({
    time: snapshot.gameTime,
    clock: formatClock(snapshot.gameTime),
    value: Math.round(safeNumber(snapshot.data?.activePlayer?.currentGold))
  }));
}

function buildLevelSeries(sampledSnapshots: SnapshotEntry[], activePlayerName: string) {
  return sampledSnapshots.map((snapshot) => {
    const player = snapshot.data?.allPlayers?.find((entry: RawEntry) => entry?.summonerName === activePlayerName);
    return {
      time: snapshot.gameTime,
      clock: formatClock(snapshot.gameTime),
      value: safeNumber(player?.level ?? snapshot.data?.activePlayer?.level)
    };
  });
}

function buildEventFeed(events: RawEntry[], playerLookup: Map<string, RawEntry>) {
  return events.map((event) => {
    const eventName = event?.EventName ?? "Unknown";
    const time = safeNumber(event?.EventTime);
    const killer = playerLookup.get(event?.KillerName);
    const victim = playerLookup.get(event?.VictimName);
    const killerLabel = killer?.championName ?? event?.KillerName ?? "";
    const victimLabel = victim?.championName ?? event?.VictimName ?? "";

    let category = "macro";
    let label = eventName;
    let team = killer?.team ?? null;

    if (eventName === "ChampionKill") {
      category = "kill";
      label = `${killerLabel} eliminou ${victimLabel}`;
    } else if (eventName === "DragonKill") {
      category = "objective";
      label = `${killerLabel || event?.KillerName} garantiu dragon ${event?.DragonType ?? ""}`.trim();
    } else if (eventName === "BaronKill") {
      category = "objective";
      label = `${killerLabel || event?.KillerName} garantiu Baron`;
    } else if (eventName === "HeraldKill" || eventName === "RiftHeraldKill") {
      category = "objective";
      label = `${killerLabel || event?.KillerName} garantiu Arauto`;
    } else if (eventName === "HordeKill" || eventName === "VoidGrubKill") {
      category = "objective";
      label = `${killerLabel || event?.KillerName} garantiu Vastilarva`;
    } else if (eventName === "TurretKilled") {
      category = "structure";
      label = `Torre caiu: ${event?.TurretKilled ?? "desconhecida"}`;
      team = getOppositeTeam(getStructureOwner(event?.TurretKilled));
    } else if (eventName === "InhibKilled") {
      category = "structure";
      label = `Inibidor caiu: ${event?.InhibKilled ?? "desconhecido"}`;
      team = getOppositeTeam(getStructureOwner(event?.InhibKilled));
    } else if (eventName === "Multikill") {
      category = "kill";
      label = `${killerLabel || event?.KillerName} fez multikill x${safeNumber(event?.KillStreak)}`;
    } else if (eventName === "FirstBlood") {
      category = "kill";
      label = `First blood para ${event?.Recipient ?? "desconhecido"}`;
    }

    return {
      id: event?.EventID ?? `${eventName}-${time}`,
      time,
      clock: formatClock(time),
      type: eventName,
      category,
      team,
      label
    };
  });
}

function getImpactScore(player: RawEntry): number {
  const scores = player?.scores ?? {};
  return (
    safeNumber(scores.kills) * 3 +
    safeNumber(scores.assists) * 1.4 -
    safeNumber(scores.deaths) * 1.6 +
    safeNumber(scores.creepScore) / 18 +
    safeNumber(scores.wardScore) / 12 +
    safeNumber(player?.level)
  );
}

function getBloodiestMinute(events: RawEntry[]) {
  const buckets = new Map<number, number>();

  for (const event of events) {
    if (event?.EventName !== "ChampionKill") continue;
    const minute = Math.floor(safeNumber(event?.EventTime) / 60);
    buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
  }

  let bestMinute: number | null = null;
  let bestKills = 0;
  for (const [minute, kills] of buckets.entries()) {
    if (kills > bestKills) {
      bestMinute = minute;
      bestKills = kills;
    }
  }

  if (bestMinute === null) {
    return { label: "-", kills: 0 };
  }

  return {
    label: `${String(bestMinute).padStart(2, "0")}:00`,
    kills: bestKills
  };
}

function getBiggestMultikill(events: RawEntry[], playerLookup: Map<string, RawEntry>) {
  const multikills = events.filter((event) => event?.EventName === "Multikill");
  if (multikills.length === 0) return null;

  const best = multikills.reduce((current, candidate) => {
    return safeNumber(candidate?.KillStreak) > safeNumber(current?.KillStreak) ? candidate : current;
  });

  return {
    size: safeNumber(best?.KillStreak),
    clock: formatClock(best?.EventTime),
    player: playerLookup.get(best?.KillerName)?.championName ?? best?.KillerName ?? "Unknown"
  };
}

function buildInsights({
  activePlayer,
  rawPlayers,
  objectives,
  overview,
  killLead,
  activeTeam
}: {
  activePlayer: any;
  rawPlayers: RawEntry[];
  objectives: any;
  overview: any;
  killLead: Array<{ lead: number }>;
  activeTeam: TeamCode;
}) {
  const insights: string[] = [];
  const activeTeamLabel = activeTeam === "ORDER" ? "ORDER" : "CHAOS";
  const enemyTeamLabel: TeamCode = activeTeamLabel === "ORDER" ? "CHAOS" : "ORDER";
  const impactSorted = [...rawPlayers].sort((left, right) => getImpactScore(right) - getImpactScore(left));
  const mvp = impactSorted[0];

  if (activePlayer) {
    insights.push(`${activePlayer.championName} terminou ${activePlayer.kills}/${activePlayer.deaths}/${activePlayer.assists} com ${activePlayer.killParticipation}% KP`);
  }

  if (mvp) {
    insights.push(
      `${mvp.championName} foi o maior impacto do jogo com ${safeNumber(mvp?.scores?.kills)}/${safeNumber(mvp?.scores?.deaths)}/${safeNumber(mvp?.scores?.assists)}`
    );
  }

  insights.push(
    `${activeTeamLabel} controlou ${objectives.dragonsByTeam[activeTeamLabel]} dragoes e ${objectives.baronsByTeam[activeTeamLabel]} Barons; ${enemyTeamLabel} ficou com ${objectives.dragonsByTeam[enemyTeamLabel]} e ${objectives.baronsByTeam[enemyTeamLabel]}`
  );

  if (overview.firstBloodAt > 0) {
    insights.push(`First blood saiu em ${formatClock(overview.firstBloodAt)}`);
  }

  if (overview.bloodiestMinute.kills > 0) {
    insights.push(`Minuto mais sangrento: ${overview.bloodiestMinute.label} com ${overview.bloodiestMinute.kills} abates`);
  }

  if (objectives.stolenObjectives.length > 0) {
    insights.push(`Houve ${objectives.stolenObjectives.length} objetivo(s) roubado(s) na sessao`);
  }

  if (killLead.length > 0) {
    const leads = killLead.map((point) => point.lead);
    const maxLead = Math.max(...leads);
    const minLead = Math.min(...leads);
    if (maxLead >= 5 || minLead <= -5) {
      const side = Math.abs(maxLead) >= Math.abs(minLead) ? activeTeamLabel : enemyTeamLabel;
      const lead = Math.max(Math.abs(maxLead), Math.abs(minLead));
      insights.push(`Maior vantagem de abates foi de ${lead} para ${side}`);
    }
  }

  return insights.slice(0, 6);
}

function buildOverview(
  events: RawEntry[],
  objectives: any,
  teamStats: Record<TeamCode, any>,
  durationSeconds: number,
  playerLookup: Map<string, RawEntry>
) {
  const firstBlood = events.find((event) => event?.EventName === "FirstBlood");
  const championKills = events.filter((event) => event?.EventName === "ChampionKill").length;
  const bloodiestMinute = getBloodiestMinute(events);
  const biggestMultikill = getBiggestMultikill(events, playerLookup);

  return {
    durationSeconds,
    totalKills: championKills,
    firstBloodAt: firstBlood ? safeNumber(firstBlood.EventTime) : 0,
    dragons: objectives.dragonsByTeam.ORDER + objectives.dragonsByTeam.CHAOS,
    barons: objectives.baronsByTeam.ORDER + objectives.baronsByTeam.CHAOS,
    heralds: objectives.heraldsByTeam.ORDER + objectives.heraldsByTeam.CHAOS,
    grubs: objectives.grubsByTeam.ORDER + objectives.grubsByTeam.CHAOS,
    towers: objectives.towersByTeam.ORDER + objectives.towersByTeam.CHAOS,
    inhibs: objectives.inhibsByTeam.ORDER + objectives.inhibsByTeam.CHAOS,
    orderKills: teamStats.ORDER.kills,
    chaosKills: teamStats.CHAOS.kills,
    bloodiestMinute,
    biggestMultikill
  };
}

function buildSessionCard(analysis: any): SessionSummary {
  return {
    sessionId: analysis.meta.sessionId,
    filename: analysis.meta.fileName,
    startTime: analysis.meta.firstSnapshotAt,
    sizeBytes: analysis.meta.sizeBytes,
  };
}

async function analyzeFile(filePath: string): Promise<SessionAnalysis> {
  const fileInfo = await stat(filePath);
  const cacheKey = `${fileInfo.size}:${fileInfo.mtimeMs}`;

  const cached = cache.get(filePath);
  if (cached?.cacheKey === cacheKey) {
    return cached.analysis;
  }

  const rawText = await readFile(filePath, "utf8");
  const entries = parseJsonLines(rawText);
  const snapshots = normalizeSnapshots(entries);

  if (snapshots.length === 0) {
    throw new Error(`Nenhum snapshot valido encontrado em ${path.basename(filePath)}.`);
  }

  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1]!;
  const sessionId = lastSnapshot.sessionId ?? path.basename(filePath).replace(/^session-/, "").replace(/\.jsonl$/, "");
  const activePlayerName = lastSnapshot.data?.activePlayer?.summonerName ?? "";
  const activePlayerEntry = lastSnapshot.data?.allPlayers?.find((player: RawEntry) => player?.summonerName === activePlayerName) ?? null;
  const allPlayers = Array.isArray(lastSnapshot.data?.allPlayers) ? lastSnapshot.data.allPlayers : [];
  const playerLookup = buildPlayerLookup(allPlayers);
  const activeTeam: TeamCode = activePlayerEntry?.team === "CHAOS" ? "CHAOS" : "ORDER";
  const teamPlayers = groupPlayersByTeam(allPlayers);
  const teamStats = {
    ORDER: summarizeTeam(teamPlayers.ORDER),
    CHAOS: summarizeTeam(teamPlayers.CHAOS)
  };
  const events = dedupeEvents(lastSnapshot.data?.events?.Events ?? []);
  const objectives = buildObjectiveSummary(events, playerLookup);
  const overview = buildOverview(events, objectives, teamStats, lastSnapshot.gameTime, playerLookup);
  const sampledSnapshots = sampleSnapshots(snapshots, 30);
  const killLead = buildKillLeadSeries(sampledSnapshots, events, playerLookup, activeTeam);
  const activePlayerSummary = activePlayerEntry
    ? buildPlayerSummary(activePlayerEntry, teamStats[activeTeam].kills)
    : null;

  const analysis = {
    meta: {
      sessionId,
      fileName: path.basename(filePath),
      sourcePath: filePath,
      sizeBytes: fileInfo.size,
      modifiedAt: fileInfo.mtime.toISOString(),
      firstSnapshotAt: firstSnapshot.ts,
      lastSnapshotAt: lastSnapshot.ts,
      snapshotCount: snapshots.length,
      durationSeconds: Math.round(lastSnapshot.gameTime),
      durationLabel: formatClock(lastSnapshot.gameTime),
      mapName: lastSnapshot.data?.gameData?.mapName ?? "Unknown",
      gameMode: lastSnapshot.data?.gameData?.gameMode ?? "Unknown",
      activePlayerName,
      activeChampion: activePlayerEntry?.championName ?? "Unknown",
      activeTeam
    },
    overview,
    finalFrame: {
      activePlayer: activePlayerSummary,
      teams: {
        ORDER: {
          code: "ORDER",
          totals: teamStats.ORDER,
          players: teamPlayers.ORDER
            .map((player: RawEntry) => buildPlayerSummary(player, teamStats.ORDER.kills))
            .sort((left, right) => right.kills - left.kills || right.assists - left.assists)
        },
        CHAOS: {
          code: "CHAOS",
          totals: teamStats.CHAOS,
          players: teamPlayers.CHAOS
            .map((player: RawEntry) => buildPlayerSummary(player, teamStats.CHAOS.kills))
            .sort((left, right) => right.kills - left.kills || right.assists - left.assists)
        }
      }
    },
    objectives,
    charts: {
      gold: buildGoldSeries(sampledSnapshots),
      level: buildLevelSeries(sampledSnapshots, activePlayerName),
      killLead
    },
    itemTimeline: buildItemTimeline(snapshots, activePlayerName),
    events: buildEventFeed(events, playerLookup),
    insights: buildInsights({
      activePlayer: activePlayerSummary,
      rawPlayers: allPlayers,
      objectives,
      overview,
      killLead,
      activeTeam
    })
  };

  cache.set(filePath, { cacheKey, analysis });
  return analysis;
}

export async function listSessionSummaries(sourceDir: string): Promise<SessionSummary[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith("session-") && entry.name.endsWith(".jsonl"))
    .map((entry) => path.join(sourceDir, entry.name));

  const analyses = await Promise.all(files.map((filePath) => analyzeFile(filePath)));
  return analyses
    .map(buildSessionCard)
    .sort((left, right) => String(right.sessionId).localeCompare(String(left.sessionId)));
}

export async function getSessionAnalysis(sourceDir: string, sessionId: string): Promise<SessionAnalysis> {
  const filePath = path.join(sourceDir, `session-${sessionId}.jsonl`);
  return analyzeFile(filePath);
}

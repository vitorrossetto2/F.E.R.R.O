import { readFileSync } from "fs";
import { join } from "path";
import type { GameEvent, GameSnapshot, SnapshotPlayer } from "./types";

export interface JungleProfile {
  championName: string;
  fastestClearTime: number;
  mostCommonStartSide: "red" | "blue";
  mostCommonPath: string[];
}

interface ClearEntry {
  champion: string;
  time: string;
  path_steps: string[];
}

interface JungleClearData {
  sections: {
    meta_junglers: { entries: ClearEntry[] };
    off_meta_junglers: { entries: ClearEntry[] };
    non_meta_junglers: { entries: ClearEntry[] };
  };
}

const RED_SIDE_CAMPS = new Set(["Raptors", "Red", "Krugs"]);

function parseTime(time: string): number {
  const [min, sec] = time.split(":").map(Number);
  return min * 60 + sec;
}

function inferStartSide(path: string[]): "red" | "blue" {
  return RED_SIDE_CAMPS.has(path[0]) ? "red" : "blue";
}

export function loadJungleProfiles(): Map<string, JungleProfile> {
  const profiles = new Map<string, JungleProfile>();

  let data: JungleClearData;
  try {
    const jsonPath = join(__dirname, "../../data/jungle_clear_s16_2026.json");
    data = JSON.parse(readFileSync(jsonPath, "utf-8"));
  } catch {
    return profiles;
  }

  const allEntries = [
    ...data.sections.meta_junglers.entries,
    ...data.sections.off_meta_junglers.entries,
    ...data.sections.non_meta_junglers.entries,
  ];

  const grouped = new Map<string, ClearEntry[]>();
  for (const entry of allEntries) {
    const list = grouped.get(entry.champion) ?? [];
    list.push(entry);
    grouped.set(entry.champion, list);
  }

  for (const [name, entries] of grouped) {
    let fastest = Infinity;
    let fastestPath: string[] = [];
    let redCount = 0;
    let blueCount = 0;

    const pathCounts = new Map<string, number>();

    for (const entry of entries) {
      const time = parseTime(entry.time);
      if (time < fastest) {
        fastest = time;
        fastestPath = entry.path_steps;
      }

      const side = inferStartSide(entry.path_steps);
      if (side === "red") redCount++;
      else blueCount++;

      const pathKey = entry.path_steps.join("->");
      pathCounts.set(pathKey, (pathCounts.get(pathKey) ?? 0) + 1);
    }

    let mostCommonPath = fastestPath;
    let maxPathCount = 0;
    for (const [pathKey, count] of pathCounts) {
      if (count > maxPathCount) {
        maxPathCount = count;
        mostCommonPath = pathKey.split("->");
      }
    }

    profiles.set(name, {
      championName: name,
      fastestClearTime: fastest,
      mostCommonStartSide: redCount >= blueCount ? "red" : "blue",
      mostCommonPath,
    });
  }

  return profiles;
}

interface JungleTrackingState {
  enemyJunglerName: string | null;
  profile: JungleProfile | null;
  firstClearAlerted: boolean;
  secondClearAlerted: boolean;
  lastKnownDeadTime: number | null;
  deathGankAlerted: boolean;
}

const WALK_TIME_SECONDS = 20;
const BASE_RETURN_SECONDS = 40;
const MAX_TRACKING_TIME = 600;
const CAMP_SPAWN_TIME = 90;
const ESTIMATED_RESPAWN_SECONDS = 30;

let trackingState: JungleTrackingState = {
  enemyJunglerName: null,
  profile: null,
  firstClearAlerted: false,
  secondClearAlerted: false,
  lastKnownDeadTime: null,
  deathGankAlerted: false,
};

export function resetJungleTrackingState(): void {
  trackingState = {
    enemyJunglerName: null,
    profile: null,
    firstClearAlerted: false,
    secondClearAlerted: false,
    lastKnownDeadTime: null,
    deathGankAlerted: false,
  };
}

function inferTargetLane(
  startSide: "red" | "blue",
  activePosition: string,
  isJungler: boolean
): string {
  if (isJungler) {
    return startSide === "red" ? "bot" : "top";
  }

  if (startSide === "red") {
    return activePosition === "TOP" || activePosition === "MIDDLE" ? "top" : "mid";
  }
  return activePosition === "BOTTOM" || activePosition === "UTILITY" ? "bot" : "mid";
}

export function collectJungleTimingTriggers(
  snapshot: GameSnapshot,
  newEvents: GameEvent[],
  playerLookup: Map<string, SnapshotPlayer>,
  profiles: Map<string, JungleProfile>
): string[] {
  if (snapshot.gameTime < CAMP_SPAWN_TIME || snapshot.gameTime > MAX_TRACKING_TIME) {
    return [];
  }

  if (!trackingState.enemyJunglerName) {
    const enemyJungler = snapshot.enemyPlayers.find((p) => p.position === "JUNGLE");
    if (!enemyJungler) return [];
    trackingState.enemyJunglerName = enemyJungler.championName;
    trackingState.profile = profiles.get(enemyJungler.championName) ?? null;
  }

  const { profile } = trackingState;
  if (!profile) return [];

  const triggers: string[] = [];
  const isJungler = snapshot.activePlayerPosition === "JUNGLE";
  const lane = inferTargetLane(profile.mostCommonStartSide, snapshot.activePlayerPosition, isJungler);

  const firstGankTime = profile.fastestClearTime + WALK_TIME_SECONDS;

  // Post-death alerts (processed first — take priority over rotation alerts)
  let deathAlertFired = false;
  for (const event of newEvents) {
    if (event?.EventName !== "ChampionKill") continue;
    if (typeof event.VictimName !== "string") continue;

    const victim = playerLookup.get(event.VictimName);
    if (!victim) continue;

    if (
      victim.championName === trackingState.enemyJunglerName &&
      snapshot.enemyPlayers.some((p) => p.summonerName === victim.summonerName)
    ) {
      if (!trackingState.deathGankAlerted) {
        if (isJungler) {
          triggers.push(`gank timing: caçador inimigo morreu, aproveita para atacar ${lane}`);
        } else {
          triggers.push(
            `gank timing: caçador inimigo morreu, quando voltar provável ataque ${lane}`
          );
        }
        trackingState.deathGankAlerted = true;
        trackingState.lastKnownDeadTime = snapshot.gameTime;
        deathAlertFired = true;
      }
    }
  }

  // Reset death alert after estimated respawn time
  if (
    trackingState.deathGankAlerted &&
    trackingState.lastKnownDeadTime !== null &&
    snapshot.gameTime >= trackingState.lastKnownDeadTime + ESTIMATED_RESPAWN_SECONDS
  ) {
    trackingState.deathGankAlerted = false;
    trackingState.lastKnownDeadTime = null;
  }

  if (deathAlertFired) {
    return triggers;
  }

  // First clear alerts
  if (!trackingState.firstClearAlerted) {
    if (isJungler) {
      if (snapshot.gameTime >= CAMP_SPAWN_TIME && snapshot.gameTime < firstGankTime) {
        triggers.push(`gank timing: caçador inimigo está limpando a selva, janela para atacar ${lane}`);
        trackingState.firstClearAlerted = true;
      }
    } else {
      if (snapshot.gameTime >= firstGankTime) {
        triggers.push(`gank timing: caçador inimigo pode atacar ${lane} a qualquer momento`);
        trackingState.firstClearAlerted = true;
      }
    }
  }

  // Second rotation alerts
  const secondGankTime = profile.fastestClearTime * 2 + BASE_RETURN_SECONDS;

  if (trackingState.firstClearAlerted && !trackingState.secondClearAlerted) {
    if (isJungler) {
      const offensiveStart = profile.fastestClearTime + BASE_RETURN_SECONDS;
      if (snapshot.gameTime >= offensiveStart && snapshot.gameTime < secondGankTime) {
        triggers.push(
          `gank timing: caçador inimigo na segunda rotação, aproveita para pressionar ${lane}`
        );
        trackingState.secondClearAlerted = true;
      }
    } else {
      if (snapshot.gameTime >= secondGankTime) {
        triggers.push(`gank timing: segunda rotação do caçador, cuidado ${lane}`);
        trackingState.secondClearAlerted = true;
      }
    }
  }

  return triggers;
}

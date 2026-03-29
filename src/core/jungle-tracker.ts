import { readFileSync } from "fs";
import { join } from "path";

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

export type TeamCode = "ORDER" | "CHAOS";

export interface TeamTotals {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  averageLevel: number;
}

export interface PlayerSummary {
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  level: number;
  items: string[];
  killParticipation: number;
  team: string;
}

export interface MatchEvent {
  type: string;
  category?: string;
  time: number;
  clock?: string;
  description: string;
  team?: string;
}

export interface InsightEntry {
  label: string;
  value: string;
}

export interface ChartPoint {
  time: number;
  clock: string;
  value: number;
}

export interface KillLeadPoint {
  time: number;
  clock: string;
  activeTeamKills: number;
  enemyTeamKills: number;
  lead: number;
}

export interface ItemTimelineEntry {
  time: number;
  clock: string;
  added: string[];
  removed: string[];
}

export interface MatchOverview {
  totalKills: number;
  firstBloodAt: number;
  bloodiestMinute?: { label: string; kills: number };
  biggestMultikill?: { size: number; clock: string; player: string } | null;
}

export interface MatchData {
  sessionInfo: { duration: number; gameMode: string; mapName?: string };
  overview?: MatchOverview;
  teams: Record<string, TeamTotals>;
  players: Record<string, Record<string, PlayerSummary>>;
  objectives: {
    dragons: Record<string, number>;
    barons: Record<string, number>;
    towers: Record<string, number>;
    inhibitors: Record<string, number>;
  };
  events: MatchEvent[];
  insights: InsightEntry[];
  charts?: {
    gold: ChartPoint[];
    level: ChartPoint[];
    killLead: KillLeadPoint[];
  };
  itemTimeline?: ItemTimelineEntry[];
  activePlayerChampion?: string;
  activePlayerName?: string;
  activePlayerTeam?: string;
  activePlayerStats?: {
    kills: number;
    deaths: number;
    assists: number;
    creepScore: number;
    level: number;
  };
}

export interface RawMatchAnalysis {
  meta?: {
    durationSeconds?: number;
    gameMode?: string;
    mapName?: string;
    activeChampion?: string;
    activePlayerName?: string;
    activeTeam?: string;
  };
  overview?: {
    totalKills?: number;
    firstBloodAt?: number;
    bloodiestMinute?: { label?: string; kills?: number };
    biggestMultikill?: { size?: number; clock?: string; player?: string } | null;
  };
  finalFrame?: {
    activePlayer?: {
      championName?: string;
      team?: string;
      kills?: number;
      deaths?: number;
      assists?: number;
      cs?: number;
      creepScore?: number;
      level?: number;
    };
    teams?: Record<string, {
      totals?: { kills?: number; deaths?: number; assists?: number; cs?: number; averageLevel?: number };
      players?: Array<{
        summonerName?: string;
        championName?: string;
        kills?: number;
        deaths?: number;
        assists?: number;
        cs?: number;
        creepScore?: number;
        level?: number;
        items?: string[];
        killParticipation?: number;
        team?: string;
      }>;
    }>;
  };
  objectives?: {
    dragonsByTeam?: Record<string, number>;
    baronsByTeam?: Record<string, number>;
    towersByTeam?: Record<string, number>;
    inhibsByTeam?: Record<string, number>;
  };
  charts?: {
    gold?: Array<{ time?: number; clock?: string; value?: number }>;
    level?: Array<{ time?: number; clock?: string; value?: number }>;
    killLead?: Array<{
      time?: number;
      clock?: string;
      activeTeamKills?: number;
      enemyTeamKills?: number;
      lead?: number;
    }>;
  };
  itemTimeline?: Array<{ time?: number; clock?: string; added?: string[]; removed?: string[] }>;
  events?: Array<{ type?: string; category?: string; time?: number; clock?: string; label?: string; description?: string; team?: string }>;
  insights?: Array<string | { label?: string; value?: string }>;
}

export interface ImpactFactor {
  label: string;
  level: "alto" | "medio" | "baixo";
}

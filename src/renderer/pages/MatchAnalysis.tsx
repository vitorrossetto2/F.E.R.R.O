import { useEffect, useState } from "react";
import type { EngineState } from "../../shared/types";
import { useEngineStore } from "../stores";

type TeamCode = "ORDER" | "CHAOS";

interface TeamTotals {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  averageLevel: number;
}

interface PlayerSummary {
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

interface MatchEvent {
  type: string;
  category?: string;
  time: number;
  clock?: string;
  description: string;
  team?: string;
}

interface InsightEntry {
  label: string;
  value: string;
}

interface ChartPoint {
  time: number;
  clock: string;
  value: number;
}

interface KillLeadPoint {
  time: number;
  clock: string;
  activeTeamKills: number;
  enemyTeamKills: number;
  lead: number;
}

interface ItemTimelineEntry {
  time: number;
  clock: string;
  added: string[];
  removed: string[];
}

interface MatchOverview {
  totalKills: number;
  firstBloodAt: number;
  bloodiestMinute?: { label: string; kills: number };
  biggestMultikill?: { size: number; clock: string; player: string } | null;
}

interface MatchData {
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

interface RawMatchAnalysis {
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

const TEAM_META: Record<TeamCode, { label: string; accent: string; background: string }> = {
  ORDER: {
    label: "Time Azul",
    accent: "var(--glow-blue)",
    background: "rgba(91, 139, 245, 0.10)",
  },
  CHAOS: {
    label: "Time Vermelho",
    accent: "var(--accent-red)",
    background: "rgba(244, 112, 104, 0.10)",
  },
};

const MODE_LABELS: Record<string, string> = {
  PRACTICETOOL: "Ferramenta de treino",
  CLASSIC: "Clássico",
  ARAM: "ARAM",
  URF: "URF",
  ONEFORALL: "Um por Todos",
  TUTORIAL: "Tutorial",
};

const MAP_LABELS: Record<string, string> = {
  Map11: "Summoner's Rift",
  Map12: "Howling Abyss",
};

function isMatchData(value: unknown): value is MatchData {
  return Boolean(value) && typeof value === "object" && "sessionInfo" in (value as Record<string, unknown>);
}

function asTeamCode(team?: string): TeamCode {
  return team === "CHAOS" ? "CHAOS" : "ORDER";
}

function getTeamLabel(team?: string): string {
  return TEAM_META[asTeamCode(team)].label;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClock(totalSeconds: number): string {
  const value = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatGold(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatMode(mode?: string): string {
  if (!mode) return "Modo desconhecido";
  return MODE_LABELS[mode] ?? mode;
}

function formatMapName(mapName?: string): string {
  if (!mapName) return "Mapa desconhecido";
  return MAP_LABELS[mapName] ?? mapName;
}

function localizeText(text: string): string {
  return text
    .replace(/\bORDER\b/g, "Time Azul")
    .replace(/\bCHAOS\b/g, "Time Vermelho")
    .replace(/\bFirst blood\b/gi, "Primeiro abate")
    .replace(/\bBarons\b/g, "Barões")
    .replace(/\bBaron\b/g, "Barão")
    .replace(/\bdragoes\b/gi, "dragões")
    .replace(/\bdragon\b/gi, "dragão")
    .replace(/\bsessao\b/gi, "sessão")
    .replace(/\bUnknown\b/gi, "Desconhecido")
    .replace(/\bGameStart\b/g, "Início da partida")
    .replace(/\bMinionsSpawning\b/g, "Tropas liberadas")
    .trim();
}

function localizeEventDescription(event: MatchEvent): string {
  const base = localizeText(event.description || event.type || "");

  if (event.type === "GameStart") return "Início da partida";
  if (event.type === "MinionsSpawning") return "Tropas liberadas";
  return base;
}

function getEventCategoryLabel(category?: string): string {
  if (category === "kill") return "Abate";
  if (category === "objective") return "Objetivo";
  if (category === "structure") return "Estrutura";
  return "Mapa";
}

function getEventCategoryColor(category?: string): string {
  if (category === "kill") return "var(--accent-red)";
  if (category === "objective") return "var(--accent-orange)";
  if (category === "structure") return "var(--glow-purple)";
  return "var(--text-muted)";
}

function getObjectiveCount(
  objectives: MatchData["objectives"],
  objective: keyof MatchData["objectives"],
  team: TeamCode
): number {
  return safeNumber(objectives?.[objective]?.[team] ?? 0);
}

function getObjectiveControlScore(data: MatchData, team: TeamCode): number {
  return (
    getObjectiveCount(data.objectives, "dragons", team) * 2 +
    getObjectiveCount(data.objectives, "barons", team) * 3 +
    getObjectiveCount(data.objectives, "towers", team) +
    getObjectiveCount(data.objectives, "inhibitors", team) * 2
  );
}

function buildTips(data: MatchData): string[] {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const myTeam = data.teams?.[activeTeam];
  const activePlayer = data.activePlayerStats;
  const durationMinutes = Math.max((data.sessionInfo.duration || 0) / 60, 1);
  const killParticipation = myTeam && activePlayer && myTeam.kills > 0
    ? ((activePlayer.kills + activePlayer.assists) / myTeam.kills) * 100
    : 0;
  const csPerMinute = activePlayer ? activePlayer.creepScore / durationMinutes : 0;
  const goldSeries = data.charts?.gold ?? [];
  const peakGold = goldSeries.length > 0 ? Math.max(...goldSeries.map((point) => point.value)) : 0;
  const myObjectiveScore = getObjectiveControlScore(data, activeTeam);
  const enemyObjectiveScore = getObjectiveControlScore(data, enemyTeam);
  const deaths = activePlayer?.deaths ?? 0;
  const tips: string[] = [];

  if (killParticipation >= 60) {
    tips.push(`Seu ponto mais forte foi participar das jogadas do time: ${formatPercent(killParticipation)} de participação em abates.`);
  } else if (csPerMinute >= 6.5) {
    tips.push(`Seu ponto mais forte foi manter recurso alto: ${formatDecimal(csPerMinute)} de farm por minuto.`);
  } else if (deaths <= 3 && data.sessionInfo.duration > 0) {
    tips.push(`Seu ponto mais forte foi se expor pouco: só ${deaths} morte${deaths === 1 ? "" : "s"} em ${formatClock(data.sessionInfo.duration)}.`);
  } else if (peakGold > 0 && peakGold < 900 && (data.itemTimeline?.length ?? 0) >= 2) {
    tips.push("Seu ponto mais forte foi transformar ouro em compra sem segurar tanto recurso parado.");
  } else if (myObjectiveScore > enemyObjectiveScore) {
    tips.push(`Seu ponto mais forte foi jogar para objetivo: ${getTeamLabel(activeTeam)} controlou mais o mapa.`);
  } else {
    tips.push("Seu ponto mais forte foi seguir relevante mesmo em uma partida mais bagunçada.");
  }

  if (peakGold >= 1200) {
    tips.push(`Você chegou a segurar ${formatGold(peakGold)} de ouro. Quando passar de 1.000, procure resetar antes da próxima luta.`);
  }

  if (csPerMinute > 0 && csPerMinute < 5 && data.sessionInfo.duration >= 8 * 60) {
    tips.push(`Seu farm ficou em ${formatDecimal(csPerMinute)}/min. Use as janelas sem luta para limpar rota ou selva próxima antes de rotacionar.`);
  }

  if (killParticipation > 0 && killParticipation < 45 && safeNumber(myTeam?.kills) >= 8) {
    tips.push(`Sua participação em abates ficou em ${formatPercent(killParticipation)}. Antecipe mais as rotações para dragão, Arauto e jogadas do seu time.`);
  }

  if (deaths >= 5) {
    tips.push(`Foram ${deaths} mortes. Antes de avançar, confirme visão e posição do caçador inimigo para não entregar pressão de graça.`);
  }

  if (enemyObjectiveScore > myObjectiveScore) {
    tips.push(`${getTeamLabel(enemyTeam)} controlou mais objetivos. Vale preparar base e visão cerca de 40 segundos antes de cada objetivo grande.`);
  }

  const bloodiestMinute = data.overview?.bloodiestMinute;
  if (bloodiestMinute && bloodiestMinute.kills >= 3) {
    tips.push(`A partida acelerou forte por volta de ${bloodiestMinute.label}. Guarde recurso e feitiços para esse primeiro pico de luta.`);
  }

  return tips.slice(0, 3);
}

interface ImpactFactor {
  label: string;
  level: "alto" | "médio" | "baixo";
}

function deriveResult(data: MatchData): "vitória" | "derrota" | "indefinido" {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam: TeamCode = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const myInhibs = getObjectiveCount(data.objectives, "inhibitors", activeTeam);
  const enemyInhibs = getObjectiveCount(data.objectives, "inhibitors", enemyTeam);
  const myScore = getObjectiveControlScore(data, activeTeam);
  const enemyScore = getObjectiveControlScore(data, enemyTeam);
  const myKills = safeNumber(data.teams?.[activeTeam]?.kills);
  const enemyKills = safeNumber(data.teams?.[enemyTeam]?.kills);
  if (myInhibs > enemyInhibs) return "vitória";
  if (enemyInhibs > myInhibs) return "derrota";
  const combined = (myScore - enemyScore) * 2 + (myKills - enemyKills);
  if (combined >= 5) return "vitória";
  if (combined <= -5) return "derrota";
  return "indefinido";
}

function getHeroResultBadge(
  data: MatchData,
  result: "vitória" | "derrota" | "indefinido"
): { label: string; background: string; color: string } {
  if (data.sessionInfo.gameMode === "PRACTICETOOL") {
    return {
      label: "Treino",
      background: "rgba(91, 139, 245, 0.12)",
      color: "var(--glow-blue)",
    };
  }

  if (result === "vitória") {
    return {
      label: "Vitória",
      background: "rgba(52, 211, 153, 0.12)",
      color: "var(--accent-green)",
    };
  }

  if (result === "derrota") {
    return {
      label: "Derrota",
      background: "rgba(244, 112, 104, 0.12)",
      color: "var(--accent-red)",
    };
  }

  return {
    label: "Sem resultado oficial",
    background: "rgba(255,255,255,0.06)",
    color: "var(--text-secondary)",
  };
}

function buildImpactFactors(
  data: MatchData,
  result: "vitória" | "derrota" | "indefinido"
): ImpactFactor[] {
  const activeTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam: TeamCode = activeTeam === "ORDER" ? "CHAOS" : "ORDER";
  const activePlayer = data.activePlayerStats;
  const myTeam = data.teams?.[activeTeam];
  const durationMinutes = Math.max((data.sessionInfo.duration || 0) / 60, 1);
  const deaths = activePlayer?.deaths ?? 0;
  const kp =
    myTeam && activePlayer && myTeam.kills > 0
      ? ((activePlayer.kills + activePlayer.assists) / myTeam.kills) * 100
      : 0;
  const cspm = activePlayer ? activePlayer.creepScore / durationMinutes : 0;
  const goldSeries = data.charts?.gold ?? [];
  const peakGold = goldSeries.length > 0 ? Math.max(...goldSeries.map((p) => p.value)) : 0;
  const myDragons = getObjectiveCount(data.objectives, "dragons", activeTeam);
  const enemyDragons = getObjectiveCount(data.objectives, "dragons", enemyTeam);
  const myTowers = getObjectiveCount(data.objectives, "towers", activeTeam);
  const enemyTowers = getObjectiveCount(data.objectives, "towers", enemyTeam);
  const factors: ImpactFactor[] = [];

  if (result !== "vitória") {
    if (deaths >= 7) {
      factors.push({ label: `${deaths} mortes — pressão cedida demais`, level: "alto" });
    } else if (deaths >= 5) {
      factors.push({ label: `${deaths} mortes — visão e posicionamento custaram caro`, level: "médio" });
    } else if (deaths >= 3 && result === "derrota") {
      factors.push({ label: `${deaths} mortes — cada morte custou recursos`, level: "baixo" });
    }
    const dragonDelta = enemyDragons - myDragons;
    if (dragonDelta >= 2) {
      factors.push({ label: `${dragonDelta} dragões a menos — perda de objetivos constante`, level: "alto" });
    } else if (dragonDelta === 1) {
      factors.push({ label: `Inimigo ficou à frente em dragões`, level: "médio" });
    }
    const towerDelta = enemyTowers - myTowers;
    if (towerDelta >= 3) {
      factors.push({ label: `${towerDelta} torres a menos — mapa totalmente cedido`, level: "alto" });
    } else if (towerDelta >= 2) {
      factors.push({ label: `${towerDelta} torres de desvantagem — rotações perdidas`, level: "médio" });
    } else if (towerDelta === 1 && result === "derrota") {
      factors.push({ label: `Inimigo derrubou mais torres`, level: "baixo" });
    }
    if (kp > 0 && kp < 30) {
      factors.push({ label: `KP de ${Math.round(kp)}% — você jogou fora das jogadas do time`, level: "alto" });
    } else if (kp > 0 && kp < 45 && myTeam && myTeam.kills >= 5) {
      factors.push({ label: `KP de ${Math.round(kp)}% — participação abaixo do esperado`, level: "médio" });
    }
    if (cspm > 0 && cspm < 3.5 && durationMinutes >= 8) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm — recurso desperdiçado na rota`, level: "alto" });
    } else if (cspm > 0 && cspm < 5 && durationMinutes >= 8) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm — abaixo do esperado`, level: "médio" });
    }
    if (peakGold >= 2000) {
      factors.push({ label: `Pico de ${formatGold(peakGold)} ouro acumulado — janela de compra perdida`, level: "alto" });
    } else if (peakGold >= 1200) {
      factors.push({ label: `${formatGold(peakGold)} de ouro represado — reset tardio`, level: "médio" });
    }
  } else {
    if (deaths <= 2) {
      factors.push({ label: `Só ${deaths} morte${deaths === 1 ? "" : "s"} — sobrevivência acima da média`, level: "alto" });
    }
    const dragonAdv = myDragons - enemyDragons;
    if (dragonAdv >= 2) {
      factors.push({ label: `${dragonAdv} dragões de vantagem — controle de objetivos sólido`, level: "alto" });
    } else if (dragonAdv === 1) {
      factors.push({ label: `Vantagem de dragões sobre o inimigo`, level: "médio" });
    }
    const towerAdv = myTowers - enemyTowers;
    if (towerAdv >= 3) {
      factors.push({ label: `${towerAdv} torres a mais — mapa dominado`, level: "alto" });
    } else if (towerAdv >= 2) {
      factors.push({ label: `${towerAdv} torres de vantagem — pressão de mapa consistente`, level: "médio" });
    }
    if (kp >= 70) {
      factors.push({ label: `KP de ${Math.round(kp)}% — você estava nas jogadas decisivas`, level: "alto" });
    } else if (kp >= 55) {
      factors.push({ label: `KP de ${Math.round(kp)}% — boa presença nas lutas`, level: "médio" });
    }
    if (cspm >= 7) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm — recurso constante durante toda a partida`, level: "alto" });
    } else if (cspm >= 5.5) {
      factors.push({ label: `${formatDecimal(cspm)}/min de farm — base de recurso sólida`, level: "médio" });
    }
    if (peakGold > 0 && peakGold < 800) {
      factors.push({ label: `Ouro convertido rápido — sem recurso represado`, level: "médio" });
    }
  }

  const order: Record<ImpactFactor["level"], number> = { alto: 0, médio: 1, baixo: 2 };
  factors.sort((a, b) => order[a.level] - order[b.level]);
  return factors.slice(0, 3);
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

export default function MatchAnalysis() {
  const engineStatus = useEngineStore((state) => state.engine.status);

  const [data, setData] = useState<MatchData | null | undefined>(undefined);

  useEffect(() => {
    window.ferroAPI.getLastMatch().then((matchData) => setData(normalizeMatchData(matchData)));
  }, []);

  if (engineStatus === "coaching") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="card-glass max-w-md p-8">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            Partida em andamento
          </h2>
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            A análise estará disponível quando o jogo terminar.
          </p>
        </div>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Carregando última partida...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          className="glow-orb glow-orb-purple"
          style={{ position: "relative", width: 120, height: 120, opacity: 0.2, animation: "breathe 3s ease-in-out infinite" }}
        />
        <h2
          className="mt-6 text-xl font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          Nenhuma partida encontrada
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Jogue uma partida e ela aparecerá aqui automaticamente.
        </p>
      </div>
    );
  }

  const duration = data.sessionInfo?.duration ?? 0;
  const champion = data.activePlayerChampion ?? "Desconhecido";
  const playerTeam = asTeamCode(data.activePlayerTeam);
  const enemyTeam: TeamCode = playerTeam === "ORDER" ? "CHAOS" : "ORDER";
  const myTeam = data.teams?.[playerTeam];
  const theirTeam = data.teams?.[enemyTeam];
  const activePlayerStats = data.activePlayerStats;
  const killDelta = safeNumber(myTeam?.kills) - safeNumber(theirTeam?.kills);
  const killTag = killDelta > 0 ? "Na frente em abates" : killDelta < 0 ? "Atrás em abates" : "Abates empatados";
  const killTagColor = killDelta > 0 ? "var(--accent-green)" : killDelta < 0 ? "var(--accent-red)" : "var(--text-secondary)";
  const result = deriveResult(data);
  const heroResultBadge = getHeroResultBadge(data, result);
  const killParticipation = myTeam && activePlayerStats && myTeam.kills > 0
    ? ((activePlayerStats.kills + activePlayerStats.assists) / myTeam.kills) * 100
    : 0;
  const csPerMinute = activePlayerStats ? activePlayerStats.creepScore / Math.max(duration / 60, 1) : 0;
  const goldSeries = data.charts?.gold ?? [];
  const peakGold = goldSeries.length > 0 ? Math.max(...goldSeries.map((point) => point.value)) : 0;
  const lastGold = goldSeries.length > 0 ? goldSeries[goldSeries.length - 1]?.value ?? 0 : 0;
  const relevantEvents = (data.events ?? []).filter((event) => {
    const description = localizeEventDescription(event);
    return description !== "Início da partida" && description !== "Tropas liberadas";
  });
  const tips = buildTips(data);
  const insightList = (data.insights ?? []).map((entry) => ({
    ...entry,
    value: localizeText(entry.value),
  }));

  return (
    <div className="space-y-6">
      <section className="animate-in grid gap-4 lg:grid-cols-[1.25fr_0.92fr]">
        <div className="flex h-full min-w-0 flex-col gap-4">
          <div className="card-glass relative overflow-hidden p-6">
          <div
            className="glow-orb glow-orb-blue"
            style={{ width: 240, height: 240, right: -80, top: -90, opacity: 0.14 }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
            Última Partida
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <h2
              className="text-4xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              {champion}
            </h2>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]"
              style={{ background: heroResultBadge.background, color: heroResultBadge.color }}
            >
              {heroResultBadge.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>{getTeamLabel(playerTeam)}</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span>{formatClock(duration)}</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span>{formatMode(data.sessionInfo.gameMode)}</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span>{formatMapName(data.sessionInfo.mapName)}</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span style={{ color: killTagColor }}>{killTag}</span>
          </div>

          <ImpactBlock data={data} result={result} />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile
              label="KDA"
              value={
                activePlayerStats
                  ? `${activePlayerStats.kills}/${activePlayerStats.deaths}/${activePlayerStats.assists}`
                  : `${safeNumber(myTeam?.kills)}/${safeNumber(myTeam?.deaths)}/${safeNumber(myTeam?.assists)}`
              }
            />
            <StatTile label="Participação" value={killParticipation > 0 ? formatPercent(killParticipation) : "-"} />
            <StatTile label="Farm/min" value={activePlayerStats ? formatDecimal(csPerMinute) : "-"} />
            <StatTile label="Pico de ouro" value={peakGold > 0 ? formatGold(peakGold) : "-"} />
          </div>
        </div>

          <GoldChart points={goldSeries} compact />

          {insightList.length > 0 && (
            <div className="card-glass px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
                Leituras da Partida
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {insightList.slice(0, 6).map((insight, index) => (
                  <div key={`${insight.label}-${index}`} className="rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                      {insight.label}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {insight.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <KillLeadMini
            points={data.charts?.killLead ?? []}
            overview={data.overview}
            activeTeam={playerTeam}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <TipsCard tips={tips} />
          <div className="card-glass p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
            Resumo Rápido
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <CompareMini
              label="Abates"
              leftValue={safeNumber(myTeam?.kills)}
              rightValue={safeNumber(theirTeam?.kills)}
              leftLabel={getTeamLabel(playerTeam)}
              rightLabel={getTeamLabel(enemyTeam)}
            />
            <CompareMini
              label="Torres"
              leftValue={getObjectiveCount(data.objectives, "towers", playerTeam)}
              rightValue={getObjectiveCount(data.objectives, "towers", enemyTeam)}
              leftLabel={getTeamLabel(playerTeam)}
              rightLabel={getTeamLabel(enemyTeam)}
            />
            <CompareMini
              label="Dragões"
              leftValue={getObjectiveCount(data.objectives, "dragons", playerTeam)}
              rightValue={getObjectiveCount(data.objectives, "dragons", enemyTeam)}
              leftLabel={getTeamLabel(playerTeam)}
              rightLabel={getTeamLabel(enemyTeam)}
            />
            <CompareMini
              label="Barões"
              leftValue={getObjectiveCount(data.objectives, "barons", playerTeam)}
              rightValue={getObjectiveCount(data.objectives, "barons", enemyTeam)}
              leftLabel={getTeamLabel(playerTeam)}
              rightLabel={getTeamLabel(enemyTeam)}
            />
          </div>

          <div className="mt-4 space-y-3">
            <QuickLine
              label="Primeiro abate"
              value={data.overview?.firstBloodAt ? formatClock(data.overview.firstBloodAt) : "-"}
            />
            <QuickLine
              label="Minuto mais tenso"
              value={data.overview?.bloodiestMinute?.kills
                ? `${data.overview.bloodiestMinute.label} (${data.overview.bloodiestMinute.kills} abates)`
                : "-"}
            />
            <QuickLine
              label="Abates no jogo"
              value={safeNumber(data.overview?.totalKills) > 0 ? String(data.overview?.totalKills) : "-"}
            />
            <QuickLine label="Ouro em mãos no fim" value={lastGold > 0 ? formatGold(lastGold) : "-"} />
          </div>
        </div>

          <EventFeedCard events={relevantEvents} />
        </div>
      </section>

      <section className="animate-in animate-in-delay-1 items-start grid gap-4 lg:grid-cols-2">
        <TeamTable
          team={playerTeam}
          players={data.players[playerTeam]}
          totals={myTeam}
          objectives={data.objectives}
          activePlayerName={data.activePlayerName}
        />
        <TeamTable
          team={enemyTeam}
          players={data.players[enemyTeam]}
          totals={theirTeam}
          objectives={data.objectives}
          activePlayerName={data.activePlayerName}
        />
      </section>

      <section className="animate-in animate-in-delay-3">
        <ItemTimelineCard timeline={data.itemTimeline ?? []} />
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
      <span className="block text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        {value}
      </span>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

function CompareMini({
  label,
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
}: {
  label: string;
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-bold" style={{ color: "var(--glow-blue)", fontFamily: "var(--font-display)" }}>
            {leftValue}
          </p>
          <p className="max-w-[5.5rem] break-words text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {leftLabel}
          </p>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          x
        </p>
        <div className="text-right">
          <p className="text-xl font-bold" style={{ color: "var(--accent-red)", fontFamily: "var(--font-display)" }}>
            {rightValue}
          </p>
          <p className="max-w-[5.5rem] break-words text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {rightLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
      <span className="min-w-0 text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="max-w-[48%] text-right text-sm font-semibold leading-snug break-words" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function GoldChart({
  points,
  compact = false,
  fillHeight = false,
}: {
  points: ChartPoint[];
  compact?: boolean;
  fillHeight?: boolean;
}) {
  const width = 720;
  const height = compact ? 140 : 180;
  const paddingX = 18;
  const paddingY = 22;

  if (points.length === 0) {
    return (
      <div className={`card-glass ${fillHeight ? "flex h-full flex-col" : ""} p-4`}>
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
          Ouro em Mãos
        </p>
        <div className={`mt-4 flex items-center justify-center rounded-2xl ${compact ? "h-24" : "h-32"} ${fillHeight ? "flex-1" : ""}`} style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Sem amostras de ouro nesta partida.
          </p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const valueRange = Math.max(maxValue - minValue, 1);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const ratioX = points.length === 1 ? 0 : index / (points.length - 1);
    const ratioY = (point.value - minValue) / valueRange;
    return {
      x: paddingX + ratioX * innerWidth,
      y: height - paddingY - ratioY * innerHeight,
      value: point.value,
      clock: point.clock,
    };
  });
  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1]?.x ?? width - paddingX} ${height - paddingY} L ${coordinates[0]?.x ?? paddingX} ${height - paddingY} Z`;
  const averageValue = Math.round(points.reduce((sum, point) => sum + point.value, 0) / points.length);
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <div className={`card-glass ${fillHeight ? "flex h-full flex-col" : ""} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
          Ouro em Mãos
        </p>
        <div className="flex gap-4">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pico <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{formatGold(maxValue)}</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Média <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{formatGold(averageValue)}</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Fim <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{formatGold(points[points.length - 1]?.value ?? 0)}</span>
          </span>
        </div>
      </div>

      <div className={`mt-2 rounded-2xl p-2 ${fillHeight ? "flex flex-1 flex-col" : ""}`} style={{ background: "rgba(255,255,255,0.03)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className={`${fillHeight ? "min-h-[7rem] flex-1" : compact ? "h-28" : "h-32"} w-full`}>
          <defs>
            <linearGradient id="gold-line" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="rgba(245, 166, 35, 0.85)" />
              <stop offset="100%" stopColor="rgba(124, 91, 245, 0.95)" />
            </linearGradient>
            <linearGradient id="gold-fill" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(245, 166, 35, 0.24)" />
              <stop offset="100%" stopColor="rgba(245, 166, 35, 0.02)" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((ratio) => {
            const y = paddingY + ratio * innerHeight;
            return (
              <line
                key={ratio}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="5 7"
              />
            );
          })}

          <path d={areaPath} fill="url(#gold-fill)" />
          <path d={linePath} fill="none" stroke="url(#gold-line)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          {lastPoint && (
            <g>
              <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill="white" opacity="0.95" />
              <circle cx={lastPoint.x} cy={lastPoint.y} r="11" fill="rgba(245, 166, 35, 0.14)" />
            </g>
          )}
        </svg>

        <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{points[0]?.clock ?? "00:00"}</span>
          <span>Pico: {formatGold(maxValue)}</span>
          <span>{points[points.length - 1]?.clock ?? "00:00"}</span>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function TipsCard({ tips }: { tips: string[] }) {
  return (
    <div className="card-glass p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
        Dicas Para a Próxima
      </p>
      <div className="mt-4 space-y-3">
        {tips.map((tip, index) => (
          <div
            key={`${index}-${tip}`}
            className="rounded-2xl px-4 py-4"
            style={{ background: index === 0 ? "rgba(52, 211, 153, 0.10)" : "rgba(255,255,255,0.03)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: index === 0 ? "var(--accent-green)" : "var(--text-muted)" }}>
              {index === 0 ? "Ponto forte" : `Ajuste ${index}`}
            </p>
            <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {tip}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamTable({
  team,
  players,
  totals,
  objectives,
  activePlayerName,
}: {
  team: TeamCode;
  players?: Record<string, PlayerSummary>;
  totals?: TeamTotals;
  objectives: MatchData["objectives"];
  activePlayerName?: string;
}) {
  const list = Object.entries(players ?? {});
  const meta = TEAM_META[team];

  return (
    <div className="card-glass overflow-hidden">
      <div className="px-5 py-4" style={{ background: meta.background, borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: meta.accent }}>
              {meta.label}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {safeNumber(totals?.kills)} abates • {safeNumber(totals?.cs)} de farm • nível médio {formatDecimal(safeNumber(totals?.averageLevel))}
            </p>
          </div>
          <div className="flex gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>Dragões {getObjectiveCount(objectives, "dragons", team)}</span>
            <span>Torres {getObjectiveCount(objectives, "towers", team)}</span>
            <span>Barões {getObjectiveCount(objectives, "barons", team)}</span>
          </div>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {list.length === 0 && (
          <div className="px-5 py-5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Sem jogadores registrados para este time.
          </div>
        )}

        {list.map(([playerName, player]) => {
          const isActivePlayer = activePlayerName === playerName;

          return (
            <div
              key={playerName}
              className="px-5 py-4"
              style={{ background: isActivePlayer ? "rgba(255,255,255,0.03)" : "transparent" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {player.championName}
                    {isActivePlayer && (
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
                        Você
                      </span>
                    )}
                  </p>
                  <p className="mt-1 break-words text-xs" style={{ color: "var(--text-secondary)" }}>
                    {playerName}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-right">
                  <PlayerMetric label="KDA" value={`${player.kills}/${player.deaths}/${player.assists}`} />
                  <PlayerMetric label="CS" value={String(player.creepScore)} />
                  <PlayerMetric label="KP" value={player.killParticipation > 0 ? formatPercent(player.killParticipation) : "-"} />
                </div>
              </div>

              {player.items.length > 0 && (
                <p className="mt-3 break-words text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Itens: {player.items.slice(0, 4).join(" • ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function ItemTimelineCard({ timeline }: { timeline: ItemTimelineEntry[] }) {
  return (
    <div className="card-glass p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
        Compras e Trocas
      </p>

      <div className="mt-4 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
        {timeline.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nenhuma troca de item registrada.
          </p>
        )}

        {timeline.slice(0, 16).map((entry, index) => (
          <div key={`${entry.clock}-${index}`} className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {entry.clock}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                Atualização de inventário
              </span>
            </div>

            {entry.added.length > 0 && (
              <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Entrou: {entry.added.join(" • ")}
              </p>
            )}

            {entry.removed.length > 0 && (
              <p className="mt-1 break-words text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Saiu: {entry.removed.join(" • ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventFeedCard({ events }: { events: MatchEvent[] }) {
  return (
    <div className="card-glass p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
        Momentos Importantes
      </p>

      <div className="mt-4 max-h-[19rem] space-y-3 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nenhum evento relevante registrado.
          </p>
        )}

        {events.slice(0, 24).map((event, index) => (
          <div key={`${event.time}-${index}`} className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {event.clock ?? formatClock(event.time)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    color: getEventCategoryColor(event.category),
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  {getEventCategoryLabel(event.category)}
                </span>
              </div>

              {event.team && (
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: TEAM_META[asTeamCode(event.team)].accent }}>
                  {getTeamLabel(event.team)}
                </span>
              )}
            </div>

            <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {localizeEventDescription(event)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactBlock({
  data,
  result,
}: {
  data: MatchData;
  result: "vitória" | "derrota" | "indefinido";
}) {
  const factors = buildImpactFactors(data, result);
  if (factors.length === 0) return null;

  const title =
    result === "vitória"
      ? "POR QUE VOCÊ GANHOU"
      : result === "derrota"
      ? "POR QUE VOCÊ PERDEU"
      : "FATORES DE IMPACTO";

  const levelColor: Record<ImpactFactor["level"], string> =
    result === "vitória"
      ? { alto: "var(--accent-green)", médio: "var(--glow-blue)", baixo: "var(--text-secondary)" }
      : { alto: "var(--accent-red)", médio: "var(--accent-orange)", baixo: "var(--text-secondary)" };

  const levelBg: Record<ImpactFactor["level"], string> =
    result === "vitória"
      ? { alto: "rgba(52, 211, 153, 0.14)", médio: "rgba(91, 139, 245, 0.14)", baixo: "rgba(255,255,255,0.06)" }
      : { alto: "rgba(244, 112, 104, 0.14)", médio: "rgba(245, 158, 11, 0.14)", baixo: "rgba(255,255,255,0.06)" };

  return (
    <div
      className="mt-5 rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em]"
        style={{
          color:
            result === "derrota"
              ? "var(--accent-red)"
              : result === "vitória"
              ? "var(--accent-green)"
              : "var(--text-muted)",
        }}
      >
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {factors.map((factor, index) => (
          <div key={`${factor.level}-${index}`} className="flex items-center gap-3">
            <span
              className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ background: levelBg[factor.level], color: levelColor[factor.level] }}
            >
              Impacto {factor.level}
            </span>
            <span className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
              {factor.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KillLeadMini({
  points,
  overview,
  activeTeam,
}: {
  points: KillLeadPoint[];
  overview?: MatchData["overview"];
  activeTeam: TeamCode;
}) {
  if (points.length < 2) return null;

  const width = 600;
  const height = 80;
  const paddingX = 12;
  const paddingY = 10;

  const leads = points.map((p) => p.lead);
  const maxLead = Math.max(...leads, 1);
  const minLead = Math.min(...leads, -1);
  const range = Math.max(maxLead - minLead, 2);
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;
  const zeroY = paddingY + ((maxLead) / range) * innerH;

  const coords = points.map((p, i) => {
    const x = paddingX + (i / (points.length - 1)) * innerW;
    const y = paddingY + ((maxLead - p.lead) / range) * innerH;
    return { x, y, lead: p.lead, clock: p.clock };
  });

  const posPath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${Math.min(c.y, zeroY)}`)
    .join(" ") + ` L ${coords[coords.length - 1]!.x} ${zeroY} L ${coords[0]!.x} ${zeroY} Z`;

  const negPath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${Math.max(c.y, zeroY)}`)
    .join(" ") + ` L ${coords[coords.length - 1]!.x} ${zeroY} L ${coords[0]!.x} ${zeroY} Z`;

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const peakLead = Math.max(...leads);
  const peakDeficit = Math.min(...leads);
  const framesAhead = leads.filter((l) => l > 0).length;
  const framesTotal = leads.length;
  const pctAhead = Math.round((framesAhead / framesTotal) * 100);

  const multikill = overview?.biggestMultikill;

  return (
    <div className="card-glass p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
          Ritmo da Partida
        </p>
        <div className="flex gap-4">
          {peakLead > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Máx.{" "}
              <span className="font-semibold" style={{ color: "var(--accent-green)" }}>
                +{peakLead}
              </span>
            </span>
          )}
          {peakDeficit < 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Mín.{" "}
              <span className="font-semibold" style={{ color: "var(--accent-red)" }}>
                {peakDeficit}
              </span>
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            À frente{" "}
            <span
              className="font-semibold"
              style={{ color: pctAhead >= 50 ? "var(--accent-green)" : "var(--accent-red)" }}
            >
              {pctAhead}%
            </span>
          </span>
        </div>
      </div>

      <div className="mt-2 rounded-2xl p-2" style={{ background: "rgba(255,255,255,0.03)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full">
          <defs>
            <linearGradient id="lead-pos" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(52, 211, 153, 0.30)" />
              <stop offset="100%" stopColor="rgba(52, 211, 153, 0.02)" />
            </linearGradient>
            <linearGradient id="lead-neg" x1="0%" x2="0%" y1="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(244, 112, 104, 0.30)" />
              <stop offset="100%" stopColor="rgba(244, 112, 104, 0.02)" />
            </linearGradient>
          </defs>
          <line
            x1={paddingX} x2={width - paddingX}
            y1={zeroY} y2={zeroY}
            stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6"
          />
          <path d={posPath} fill="url(#lead-pos)" />
          <path d={negPath} fill="url(#lead-neg)" />
          <path d={linePath} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span>{points[0]?.clock ?? "00:00"}</span>
          <span>Vantagem em abates</span>
          <span>{points[points.length - 1]?.clock ?? "00:00"}</span>
        </div>
      </div>

      {multikill && multikill.size >= 2 && (
        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: "rgba(245, 158, 11, 0.14)", color: "var(--accent-orange)" }}
          >
            {multikill.size === 2 ? "Double" : multikill.size === 3 ? "Triple" : multikill.size === 4 ? "Quadra" : "Penta"}
          </span>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {multikill.player} aos {multikill.clock}
          </span>
        </div>
      )}
    </div>
  );
}

import type { TeamCode } from "./types";

export const TEAM_META: Record<TeamCode, { label: string; accent: string; background: string }> = {
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

export const MODE_LABELS: Record<string, string> = {
  PRACTICETOOL: "Ferramenta de treino",
  CLASSIC: "ClÃ¡ssico",
  ARAM: "ARAM",
  URF: "URF",
  ONEFORALL: "Um por Todos",
  TUTORIAL: "Tutorial",
};

export const MAP_LABELS: Record<string, string> = {
  Map11: "Summoner's Rift",
  Map12: "Howling Abyss",
};

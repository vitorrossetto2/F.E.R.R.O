import { MAP_LABELS, MODE_LABELS, TEAM_META } from "./constants";
import type { MatchEvent, TeamCode } from "./types";

export function asTeamCode(team?: string): TeamCode {
  return team === "CHAOS" ? "CHAOS" : "ORDER";
}

export function getTeamLabel(team?: string): string {
  return TEAM_META[asTeamCode(team)].label;
}

export function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatClock(totalSeconds: number): string {
  const value = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatGold(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatMode(mode?: string): string {
  if (!mode) return "Modo desconhecido";
  return MODE_LABELS[mode] ?? mode;
}

export function formatMapName(mapName?: string): string {
  if (!mapName) return "Mapa desconhecido";
  return MAP_LABELS[mapName] ?? mapName;
}

export function localizeText(text: string): string {
  return text
    .replace(/\bORDER\b/g, "Time Azul")
    .replace(/\bCHAOS\b/g, "Time Vermelho")
    .replace(/\bFirst blood\b/gi, "Primeiro abate")
    .replace(/\bBarons\b/g, "BarÃµes")
    .replace(/\bBaron\b/g, "BarÃ£o")
    .replace(/\bdragoes\b/gi, "dragÃµes")
    .replace(/\bdragon\b/gi, "dragÃ£o")
    .replace(/\bsessao\b/gi, "sessÃ£o")
    .replace(/\bUnknown\b/gi, "Desconhecido")
    .replace(/\bGameStart\b/g, "InÃ­cio da partida")
    .replace(/\bMinionsSpawning\b/g, "Tropas liberadas")
    .trim();
}

export function localizeEventDescription(event: MatchEvent): string {
  const base = localizeText(event.description || event.type || "");

  if (event.type === "GameStart") return "InÃ­cio da partida";
  if (event.type === "MinionsSpawning") return "Tropas liberadas";
  return base;
}

export function getEventCategoryLabel(category?: string): string {
  if (category === "kill") return "Abate";
  if (category === "objective") return "Objetivo";
  if (category === "structure") return "Estrutura";
  return "Mapa";
}

export function getEventCategoryColor(category?: string): string {
  if (category === "kill") return "var(--accent-red)";
  if (category === "objective") return "var(--accent-orange)";
  if (category === "structure") return "var(--glow-purple)";
  return "var(--text-muted)";
}

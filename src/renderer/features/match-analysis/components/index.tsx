import { TEAM_META } from "../constants";
import {
  asTeamCode,
  formatClock,
  formatDecimal,
  formatGold,
  formatPercent,
  getEventCategoryColor,
  getEventCategoryLabel,
  getTeamLabel,
  localizeEventDescription,
  safeNumber,
} from "../formatters";
import { buildImpactFactors, getObjectiveCount } from "../insights";
import type {
  ChartPoint,
  ImpactFactor,
  ItemTimelineEntry,
  KillLeadPoint,
  MatchData,
  MatchEvent,
  PlayerSummary,
  TeamCode,
  TeamTotals,
} from "../types";

export function StatTile({ label, value }: { label: string; value: string }) {
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

export function CompareMini({
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

export function QuickLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
      <span className="min-w-0 text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="max-w-[48%] break-words text-right text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

export function GoldChart({
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
          Ouro em MÃ£os
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
          Ouro em MÃ£os
        </p>
        <div className="flex gap-4">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pico <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{formatGold(maxValue)}</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            MÃ©dia <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{formatGold(averageValue)}</span>
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

export function TipsCard({ tips }: { tips: string[] }) {
  return (
    <div className="card-glass p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
        Dicas Para a PrÃ³xima
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

export function TeamTable({
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
              {safeNumber(totals?.kills)} abates â€¢ {safeNumber(totals?.cs)} de farm â€¢ nÃ­vel mÃ©dio {formatDecimal(safeNumber(totals?.averageLevel))}
            </p>
          </div>
          <div className="flex gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>DragÃµes {getObjectiveCount(objectives, "dragons", team)}</span>
            <span>Torres {getObjectiveCount(objectives, "towers", team)}</span>
            <span>BarÃµes {getObjectiveCount(objectives, "barons", team)}</span>
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
                        VocÃª
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
                  Itens: {player.items.slice(0, 4).join(" â€¢ ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ItemTimelineCard({ timeline }: { timeline: ItemTimelineEntry[] }) {
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
                AtualizaÃ§Ã£o de inventÃ¡rio
              </span>
            </div>

            {entry.added.length > 0 && (
              <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Entrou: {entry.added.join(" â€¢ ")}
              </p>
            )}

            {entry.removed.length > 0 && (
              <p className="mt-1 break-words text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Saiu: {entry.removed.join(" â€¢ ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventFeedCard({ events }: { events: MatchEvent[] }) {
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

export function ImpactBlock({
  data,
  result,
}: {
  data: MatchData;
  result: "vitoria" | "derrota" | "indefinido";
}) {
  const factors = buildImpactFactors(data, result);
  if (factors.length === 0) return null;

  const title =
    result === "vitoria"
      ? "POR QUE VOCE GANHOU"
      : result === "derrota"
        ? "POR QUE VOCE PERDEU"
        : "FATORES DE IMPACTO";

  const levelColor: Record<ImpactFactor["level"], string> =
    result === "vitoria"
      ? { alto: "var(--accent-green)", medio: "var(--glow-blue)", baixo: "var(--text-secondary)" }
      : { alto: "var(--accent-red)", medio: "var(--accent-orange)", baixo: "var(--text-secondary)" };

  const levelBg: Record<ImpactFactor["level"], string> =
    result === "vitoria"
      ? { alto: "rgba(52, 211, 153, 0.14)", medio: "rgba(91, 139, 245, 0.14)", baixo: "rgba(255,255,255,0.06)" }
      : { alto: "rgba(244, 112, 104, 0.14)", medio: "rgba(245, 158, 11, 0.14)", baixo: "rgba(255,255,255,0.06)" };

  return (
    <div className="mt-5 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em]"
        style={{
          color:
            result === "derrota" ? "var(--accent-red)" : result === "vitoria" ? "var(--accent-green)" : "var(--text-muted)",
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

export function KillLeadMini({
  points,
  overview,
}: {
  points: KillLeadPoint[];
  overview?: MatchData["overview"];
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
  const zeroY = paddingY + (maxLead / range) * innerH;

  const coords = points.map((p, i) => {
    const x = paddingX + (i / (points.length - 1)) * innerW;
    const y = paddingY + ((maxLead - p.lead) / range) * innerH;
    return { x, y, lead: p.lead, clock: p.clock };
  });

  const posPath =
    coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${Math.min(c.y, zeroY)}`).join(" ") +
    ` L ${coords[coords.length - 1]!.x} ${zeroY} L ${coords[0]!.x} ${zeroY} Z`;
  const negPath =
    coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${Math.max(c.y, zeroY)}`).join(" ") +
    ` L ${coords[coords.length - 1]!.x} ${zeroY} L ${coords[0]!.x} ${zeroY} Z`;
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const peakLead = Math.max(...leads);
  const peakDeficit = Math.min(...leads);
  const framesAhead = leads.filter((l) => l > 0).length;
  const pctAhead = Math.round((framesAhead / leads.length) * 100);
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
              MÃ¡x. <span className="font-semibold" style={{ color: "var(--accent-green)" }}>+{peakLead}</span>
            </span>
          )}
          {peakDeficit < 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              MÃ­n. <span className="font-semibold" style={{ color: "var(--accent-red)" }}>{peakDeficit}</span>
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Ã€ frente <span className="font-semibold" style={{ color: pctAhead >= 50 ? "var(--accent-green)" : "var(--accent-red)" }}>{pctAhead}%</span>
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
          <line x1={paddingX} x2={width - paddingX} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 6" />
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

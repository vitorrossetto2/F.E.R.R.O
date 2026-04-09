import {
  asTeamCode,
  buildTips,
  CompareMini,
  deriveResult,
  EventFeedCard,
  formatClock,
  formatDecimal,
  formatGold,
  formatMapName,
  formatMode,
  formatPercent,
  getHeroResultBadge,
  getObjectiveCount,
  getTeamLabel,
  GoldChart,
  ImpactBlock,
  ItemTimelineCard,
  KillLeadMini,
  localizeEventDescription,
  localizeText,
  normalizeMatchData,
  QuickLine,
  safeNumber,
  StatTile,
  TeamTable,
  TipsCard,
  useMatchAnalysisData,
} from "../features/match-analysis";
import type { TeamCode } from "../features/match-analysis";
import { useEngineStore } from "../stores";

export { normalizeMatchData } from "../features/match-analysis";

export default function MatchAnalysis() {
  const engineStatus = useEngineStore((state) => state.engine.status);
  const data = useMatchAnalysisData();

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
        <h2 className="mt-6 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
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
            <div className="glow-orb glow-orb-blue" style={{ width: 240, height: 240, right: -80, top: -90, opacity: 0.14 }} />
            <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              Última Partida
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
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

          <KillLeadMini points={data.charts?.killLead ?? []} overview={data.overview} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <TipsCard tips={tips} />
          <div className="card-glass p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              Resumo Rápido
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <CompareMini label="Abates" leftValue={safeNumber(myTeam?.kills)} rightValue={safeNumber(theirTeam?.kills)} leftLabel={getTeamLabel(playerTeam)} rightLabel={getTeamLabel(enemyTeam)} />
              <CompareMini label="Torres" leftValue={getObjectiveCount(data.objectives, "towers", playerTeam)} rightValue={getObjectiveCount(data.objectives, "towers", enemyTeam)} leftLabel={getTeamLabel(playerTeam)} rightLabel={getTeamLabel(enemyTeam)} />
              <CompareMini label="Dragões" leftValue={getObjectiveCount(data.objectives, "dragons", playerTeam)} rightValue={getObjectiveCount(data.objectives, "dragons", enemyTeam)} leftLabel={getTeamLabel(playerTeam)} rightLabel={getTeamLabel(enemyTeam)} />
              <CompareMini label="Barões" leftValue={getObjectiveCount(data.objectives, "barons", playerTeam)} rightValue={getObjectiveCount(data.objectives, "barons", enemyTeam)} leftLabel={getTeamLabel(playerTeam)} rightLabel={getTeamLabel(enemyTeam)} />
            </div>

            <div className="mt-4 space-y-3">
              <QuickLine label="Primeiro abate" value={data.overview?.firstBloodAt ? formatClock(data.overview.firstBloodAt) : "-"} />
              <QuickLine label="Minuto mais tenso" value={data.overview?.bloodiestMinute?.kills ? `${data.overview.bloodiestMinute.label} (${data.overview.bloodiestMinute.kills} abates)` : "-"} />
              <QuickLine label="Abates no jogo" value={safeNumber(data.overview?.totalKills) > 0 ? String(data.overview?.totalKills) : "-"} />
              <QuickLine label="Ouro em mãos no fim" value={lastGold > 0 ? formatGold(lastGold) : "-"} />
            </div>
          </div>

          <EventFeedCard events={relevantEvents} />
        </div>
      </section>

      <section className="animate-in animate-in-delay-1 items-start grid gap-4 lg:grid-cols-2">
        <TeamTable team={playerTeam} players={data.players[playerTeam]} totals={myTeam} objectives={data.objectives} activePlayerName={data.activePlayerName} />
        <TeamTable team={enemyTeam} players={data.players[enemyTeam]} totals={theirTeam} objectives={data.objectives} activePlayerName={data.activePlayerName} />
      </section>

      <section className="animate-in animate-in-delay-3">
        <ItemTimelineCard timeline={data.itemTimeline ?? []} />
      </section>
    </div>
  );
}

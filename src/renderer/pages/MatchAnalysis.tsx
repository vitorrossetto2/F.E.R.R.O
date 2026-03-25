import { useEffect, useState } from "react";

interface MatchData {
  sessionInfo: { duration: number; gameMode: string };
  teams: Record<string, { kills: number; deaths: number; assists: number; cs: number; averageLevel: number }>;
  players: Record<string, Record<string, { championName: string; kills: number; deaths: number; assists: number; creepScore: number; level: number; items: string[]; killParticipation: number; team: string }>>;
  objectives: { dragons: Record<string, number>; barons: Record<string, number>; towers: Record<string, number>; inhibitors: Record<string, number> };
  events: Array<{ type: string; time: number; description: string; team?: string }>;
  insights: Array<{ label: string; value: string }>;
  activePlayerChampion?: string;
  activePlayerTeam?: string;
}

export default function MatchAnalysis() {
  const [data, setData] = useState<MatchData | null | undefined>(undefined);

  useEffect(() => {
    window.ferroAPI.getLastMatch().then((d) => setData(d as MatchData | null));
  }, []);

  // Loading
  if (data === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Carregando...</p>
      </div>
    );
  }

  // Empty state
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
  const durationStr = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`;
  const champion = data.activePlayerChampion ?? "—";
  const playerTeam = data.activePlayerTeam ?? "ORDER";
  const enemyTeam = playerTeam === "ORDER" ? "CHAOS" : "ORDER";

  const myTeam = data.teams?.[playerTeam];
  const theirTeam = data.teams?.[enemyTeam];
  const won = myTeam && theirTeam ? myTeam.kills > theirTeam.kills : null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="animate-in text-center">
        <h2
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          {champion}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {durationStr}
          </span>
          {won !== null && (
            <span
              className="rounded-full px-3 py-0.5 text-xs font-semibold"
              style={{
                background: won ? "rgba(52, 211, 153, 0.12)" : "rgba(244, 112, 104, 0.12)",
                color: won ? "var(--accent-green)" : "var(--accent-red)",
              }}
            >
              {won ? "Vitória" : "Derrota"}
            </span>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      {myTeam && (
        <div className="animate-in animate-in-delay-1 grid grid-cols-4 gap-3">
          <StatTile label="KDA" value={`${myTeam.kills}/${myTeam.deaths}/${myTeam.assists}`} />
          <StatTile label="Dragões" value={String(data.objectives?.dragons?.[playerTeam] ?? 0)} />
          <StatTile label="Torres" value={String(data.objectives?.towers?.[playerTeam] ?? 0)} />
          <StatTile label="Barão" value={String(data.objectives?.barons?.[playerTeam] ?? 0)} />
        </div>
      )}

      {/* Insights */}
      {data.insights && data.insights.length > 0 && (
        <div className="animate-in animate-in-delay-2 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Insights
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {data.insights.slice(0, 6).map((insight, i) => (
              <div key={i} className="card-glass px-4 py-3">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{insight.label}</p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {insight.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {data.events && data.events.length > 0 && (
        <div className="animate-in animate-in-delay-3 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Eventos
          </h3>
          <div className="card-glass max-h-80 overflow-y-auto p-4">
            {data.events.slice(0, 50).map((event, i) => {
              const mins = Math.floor(event.time / 60);
              const secs = Math.floor(event.time % 60);
              const color = event.type === "kill" ? "var(--accent-red)"
                : event.type === "objective" ? "var(--glow-purple)"
                : event.type === "structure" ? "var(--accent-orange)"
                : "var(--text-muted)";

              return (
                <div key={i} className="flex items-start gap-3 py-1.5" style={{ fontSize: 13 }}>
                  <span className="w-10 shrink-0 text-right" style={{ color: "var(--text-muted)" }}>
                    {mins}:{String(secs).padStart(2, "0")}
                  </span>
                  <span className="shrink-0 text-xs font-medium" style={{ color }}>
                    {event.type}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {event.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      {data.players && (
        <div className="animate-in animate-in-delay-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Placar Final
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <TeamTable label={playerTeam} players={data.players[playerTeam]} isAlly />
            <TeamTable label={enemyTeam} players={data.players[enemyTeam]} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-glass flex flex-col items-center gap-1 py-4">
      <span className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

function TeamTable({
  label,
  players,
  isAlly = false,
}: {
  label: string;
  players?: Record<string, { championName: string; kills: number; deaths: number; assists: number; creepScore: number }>;
  isAlly?: boolean;
}) {
  if (!players) return null;
  const list = Object.values(players);

  return (
    <div className="card-glass overflow-hidden">
      <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span
          className="text-xs font-semibold uppercase"
          style={{ color: isAlly ? "var(--glow-blue)" : "var(--accent-red)" }}
        >
          {label}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {list.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              {p.championName}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.kills}/{p.deaths}/{p.assists} · {p.creepScore} CS
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

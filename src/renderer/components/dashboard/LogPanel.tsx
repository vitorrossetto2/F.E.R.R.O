import { useEffect, useRef, useState } from "react";
import { useLogsStore } from "../../stores";

export default function LogPanel() {
  const [expanded, setExpanded] = useState(false);
  const logs = useLogsStore((state) => state.logs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, expanded]);

  const typeColor = (type: string) => {
    if (type.includes("error")) return "var(--accent-red)";
    if (type.includes("speak") || type.includes("coaching")) return "var(--glow-purple)";
    if (type.includes("game_detected")) return "var(--accent-green)";
    return "var(--text-muted)";
  };

  return (
    <div className="card-glass overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span className="text-sm font-medium" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
          Logs avançados
        </span>
        <svg
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div
          className="overflow-y-auto px-5 pb-4 font-mono text-sm"
          style={{ maxHeight: 384, borderTop: "1px solid var(--border-subtle)", background: "var(--bg-input)" }}
        >
          {logs.length === 0 && (
            <p className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
              Nenhum log ainda. O engine está aguardando partida.
            </p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 py-1" style={{ fontSize: 13 }}>
              <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                {new Date(log.ts).toLocaleTimeString("pt-BR")}
              </span>
              <span className="shrink-0" style={{ color: typeColor(log.type) }}>
                {log.type}
              </span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {log.gameTime !== undefined
                  ? `${Math.floor(log.gameTime / 60)}:${String(Math.floor(log.gameTime % 60)).padStart(2, "0")} `
                  : ""}
                {String((log as Record<string, unknown>).message ?? (log as Record<string, unknown>).reason ?? "")}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

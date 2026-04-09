import { ACCENT_COLORS } from "../constants";

export function StatCard({
  label,
  value,
  accent,
  detail,
  ratio,
}: {
  label: string;
  value: string;
  accent: keyof typeof ACCENT_COLORS;
  detail?: string;
  ratio?: number;
}) {
  const color = ACCENT_COLORS[accent];

  return (
    <div
      className="stat-card group relative overflow-hidden rounded-2xl px-5 py-4"
      style={{
        border: `1px solid rgba(${color.rgb}, 0.12)`,
        background: `linear-gradient(135deg, rgba(${color.rgb}, 0.04) 0%, rgba(${color.rgb}, 0.01) 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ background: color.glow }}
      />

      <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>

      <div className="relative mt-2 flex items-end justify-between gap-3">
        <p
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          {value}
        </p>

        {ratio !== undefined && (
          <svg width="36" height="36" viewBox="0 0 36 36" className="mb-0.5 flex-shrink-0">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={color.glow}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${ratio * 94.25} ${94.25}`}
              transform="rotate(-90 18 18)"
              style={{ filter: `drop-shadow(0 0 4px rgba(${color.rgb}, 0.5))` }}
            />
          </svg>
        )}
      </div>

      {detail && (
        <p className="relative mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {detail}
        </p>
      )}
    </div>
  );
}

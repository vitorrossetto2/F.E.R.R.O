import type { MessageCategoryConfig } from "../../../../shared/types";
import {
  ADJUSTABLE_CATEGORIES,
  CATEGORY_MAP,
} from "../constants";
import type { MessageCategoryId, MessageGroupDefinition } from "../types";

export function MessageGroupCard({
  group,
  messages,
  onToggle,
  onSetCooldown,
}: {
  group: MessageGroupDefinition;
  messages: Record<MessageCategoryId, MessageCategoryConfig>;
  onToggle: (id: MessageCategoryId) => void;
  onSetCooldown: (id: MessageCategoryId, value: number) => void;
}) {
  const enabledCount = group.categories.filter((categoryId) => messages[categoryId].enabled).length;

  return (
    <section className="card-glass overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="px-5 py-5">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
            {group.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {group.desc}
          </p>
        </div>
        <span
          className="mr-5 mt-5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
        >
          {enabledCount}/{group.categories.length} ativos
        </span>
      </div>

      <div className="px-5 pb-2">
        {group.categories.map((categoryId) => {
          const category = CATEGORY_MAP[categoryId];
          const config = messages[categoryId];
          const hasCooldown = ADJUSTABLE_CATEGORIES.has(categoryId);
          const isLast = group.categories[group.categories.length - 1] === categoryId;

          return (
            <div
              key={categoryId}
              className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              style={{ borderBottom: isLast ? "none" : "1px solid var(--border-subtle)" }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={config.enabled}
                onClick={() => onToggle(categoryId)}
                className="toggle-track"
              >
                <span className="toggle-thumb" />
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="text-sm font-medium"
                    style={{ color: config.enabled ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {category.label}
                  </p>
                  {hasCooldown && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ background: "rgba(91, 139, 245, 0.12)", color: "var(--glow-blue)" }}
                    >
                      Ajustável
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {category.desc}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 justify-self-start sm:items-end sm:justify-self-end">
                {hasCooldown ? (
                  config.enabled ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={600}
                        value={config.cooldownSeconds}
                        onChange={(event) => onSetCooldown(categoryId, parseInt(event.target.value, 10) || 5)}
                        className="input-field text-center text-xs"
                        style={{ width: 78 }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        seg
                      </span>
                    </label>
                  ) : (
                    <span className="status-chip status-chip-off">Desligado</span>
                  )
                ) : (
                  <span className={`status-chip ${config.enabled ? "status-chip-on" : "status-chip-off"}`}>
                    {config.enabled ? "Ligado" : "Desligado"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

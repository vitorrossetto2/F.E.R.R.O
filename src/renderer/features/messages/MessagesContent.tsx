import { useState } from "react";
import type {
  ElevenLabsUsageSummary,
  FerroConfig,
  MessageCategoryConfig,
  MessageMode,
} from "../../../shared/types";
import {
  BRL_FORMATTER,
  CATEGORY_DEFINITIONS,
  MESSAGE_GROUPS,
  MESSAGE_MODE_OPTIONS,
  MODE_PREVIEWS,
} from "./constants";
import { MESSAGE_PRESETS } from "./presets";
import {
  countEnabled,
  estimateTheoreticalCost,
  formatDuration,
  isElevenLabsConfigured,
  isPresetActive,
} from "./selectors";
import { MessageGroupCard, StatCard } from "./components";
import type { MessageCategoryId } from "./types";

export interface MessagesContentProps {
  config: FerroConfig;
  messages: Record<MessageCategoryId, MessageCategoryConfig>;
  elevenLabsUsageSummary?: ElevenLabsUsageSummary | null;
  onToggle: (id: MessageCategoryId) => void;
  onSetCooldown: (id: MessageCategoryId, value: number) => void;
  onSetMessageMode: (mode: MessageMode) => void;
  onApplyPreset: (messages: Record<MessageCategoryId, MessageCategoryConfig>) => void;
}

export function MessagesContent({
  config,
  messages,
  elevenLabsUsageSummary,
  onToggle,
  onSetCooldown,
  onSetMessageMode,
  onApplyPreset,
}: MessagesContentProps) {
  const [llmExample, setLlmExample] = useState<{ message: string; llmMs: number } | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const theoreticalEstimate = estimateTheoreticalCost(messages);
  const usageEstimate = elevenLabsUsageSummary ?? null;
  const activeMessages = countEnabled(messages);
  const activeMode =
    MESSAGE_MODE_OPTIONS.find((mode) => mode.id === config.coach.messageMode) ?? MESSAGE_MODE_OPTIONS[0];
  const activePreset = MESSAGE_PRESETS.find((preset) => isPresetActive(messages, preset.config)) ?? null;
  const showVoiceCost = isElevenLabsConfigured(config);

  return (
    <div className="space-y-8">
      <section className="card-glass relative overflow-hidden px-6 py-6">
        <div
          className="glow-orb glow-orb-blue"
          style={{ width: 240, height: 240, top: -120, right: -40, opacity: 0.12 }}
        />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              Mensagens do Coach
            </p>
            <h2
              className="mt-3 text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Configure o que o coach deve priorizar durante a partida.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Escolha o modo de voz, aplique um preset e ajuste apenas os avisos que precisam de intervalo próprio.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                    Modo de voz
                  </h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MESSAGE_MODE_OPTIONS.map((mode) => {
                    const active = config.coach.messageMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSetMessageMode(mode.id)}
                        className="rounded-full px-4 py-2 text-sm font-medium transition"
                        style={{
                          border: active ? "1px solid rgba(91, 139, 245, 0.65)" : "1px solid var(--border-subtle)",
                          background: active ? "rgba(91, 139, 245, 0.12)" : "rgba(255,255,255,0.02)",
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                          boxShadow: active ? "0 0 0 1px rgba(91, 139, 245, 0.18)" : "none",
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {activeMode.desc}
                </p>
                <div className="mt-3 card-glass space-y-2 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                    Exemplos
                  </p>
                  {MODE_PREVIEWS[config.coach.messageMode].map((phrase, i) => (
                    <p key={i} className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      "{phrase}"
                    </p>
                  ))}
                  <button
                    type="button"
                    className="mt-2 rounded-full px-3 py-1.5 text-xs font-medium transition"
                    style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
                    onClick={() => {
                      const phrases = MODE_PREVIEWS[config.coach.messageMode];
                      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
                      void window.ferroAPI.testTTS(config.tts.activeProvider, phrase);
                    }}
                  >
                    Ouvir exemplo
                  </button>
                </div>
                {config.llm.activeProvider !== "none" && (
                  <div className="mt-3 card-glass space-y-2 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                      Exemplo da IA
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Cenário fictício: Jinx bot, 3 min, Draven 2/0 na lane.
                    </p>
                    {llmExample && (
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                        "{llmExample.message}"
                        <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          ({llmExample.llmMs}ms)
                        </span>
                      </p>
                    )}
                    {llmError && (
                      <p className="text-xs" style={{ color: "var(--accent-red)" }}>{llmError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={llmLoading}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                        style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", opacity: llmLoading ? 0.5 : 1 }}
                        onClick={async () => {
                          setLlmLoading(true);
                          setLlmError(null);
                          try {
                            const result = await window.ferroAPI.testLLMCoaching();
                            if (result.ok) {
                              setLlmExample({ message: result.message, llmMs: result.llmMs });
                            } else {
                              setLlmError(result.error);
                            }
                          } catch (error) {
                            setLlmError(error instanceof Error ? error.message : "Erro ao gerar exemplo");
                          }
                          setLlmLoading(false);
                        }}
                      >
                        {llmLoading ? "Gerando..." : "Gerar exemplo"}
                      </button>
                      {llmExample && (
                        <button
                          type="button"
                          className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                          style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
                          onClick={() => void window.ferroAPI.testTTS(config.tts.activeProvider, llmExample.message)}
                        >
                          Ouvir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                    Presets
                  </h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MESSAGE_PRESETS.map((preset) => {
                    const active = isPresetActive(messages, preset.config);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onApplyPreset(preset.config)}
                        className="rounded-full px-4 py-2 text-sm font-medium transition"
                        style={{
                          border: active ? "1px solid rgba(124, 91, 245, 0.7)" : "1px solid var(--border-subtle)",
                          background: active ? "rgba(124, 91, 245, 0.12)" : "rgba(255,255,255,0.02)",
                          color: active ? "var(--text-primary)" : "var(--text-secondary)",
                          boxShadow: active ? "0 0 0 1px rgba(124, 91, 245, 0.18)" : "none",
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {activePreset?.desc ?? "As categorias foram ajustadas manualmente para esta conta."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 self-start">
            <StatCard
              label="Categorias ativas"
              value={`${activeMessages}/${CATEGORY_DEFINITIONS.length}`}
              accent="blue"
              ratio={activeMessages / CATEGORY_DEFINITIONS.length}
            />
            <StatCard label="Modo atual" value={activeMode.label} accent="purple" detail={activeMode.desc} />
            {showVoiceCost && (
              <StatCard
                label="Custo de voz"
                value={
                  usageEstimate
                    ? `~R$ ${BRL_FORMATTER.format(usageEstimate.costBRL)}`
                    : `~R$ ${BRL_FORMATTER.format(theoreticalEstimate.costBRL)}`
                }
                accent="cyan"
                detail={
                  usageEstimate
                    ? `${usageEstimate.ttsCount} falas em ${formatDuration(usageEstimate.durationSeconds)}`
                    : "Estimativa teórica sem log recente."
                }
              />
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {MESSAGE_GROUPS.map((group) => (
          <MessageGroupCard
            key={group.id}
            group={group}
            messages={messages}
            onToggle={onToggle}
            onSetCooldown={onSetCooldown}
          />
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ElevenLabsUsageSummary, FerroConfig, MessageCategoryConfig, MessageMode } from "../../shared/types";

const CATEGORIES = [
  { id: "objetivo", label: "Objetivos", desc: "Dragão, Barão, Arauto, Grubs" },
  { id: "torre", label: "Torres inimigas", desc: "Queda de torre inimiga" },
  { id: "torrePerdida", label: "Torres perdidas", desc: "Quando perdemos uma torre" },
  { id: "morteJogador", label: "Mortes", desc: "Quando você morre" },
  { id: "morteStreak", label: "Sequência de mortes", desc: "Quando você morre várias vezes" },
  { id: "itemFechado", label: "Itens", desc: "Item importante completado" },
  { id: "inimigoItem", label: "Itens inimigos", desc: "Inimigo comprou item perigoso/counter" },
  { id: "powerspike", label: "Powerspike", desc: "Pico de poder detectado" },
  { id: "mapa", label: "Minimapa", desc: "Lembretes para olhar o minimapa" },
  { id: "inimigoFed", label: "Inimigo fed", desc: "Inimigo alimentado e perigoso" },
  { id: "inimigoBuild", label: "Build inimiga", desc: "Inimigo acelerou a build" },
  { id: "ouroParado", label: "Ouro parado", desc: "Gold acumulado sem gastar" },
  { id: "levelUp", label: "Level up", desc: "Nível 6, 11 ou 16 atingido" },
  { id: "inibidor", label: "Inibidor", desc: "Inibidor destruído" },
  { id: "generico", label: "Genérico", desc: "Outras mensagens do coach" },
];

export const MESSAGE_MODE_OPTIONS: Array<{ id: MessageMode; label: string; desc: string }> = [
  { id: "serio", label: "Sério", desc: "Tom atual, direto e profissional." },
  { id: "meme", label: "Meme", desc: "Mais brincalhão, debochado e caótico." },
  { id: "puto", label: "Puto", desc: "Mais agressivo, cobrando tudo e com palavrão." },
];

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INTEGER_FORMATTER = new Intl.NumberFormat("pt-BR");

function estimateTheoreticalCost(messages: Record<string, MessageCategoryConfig>) {
  const GAME_DURATION_S = 1800;
  const AVG_CHARS_PER_MSG = 75;
  const ELEVENLABS_STARTER_USD = 5;
  const ELEVENLABS_STARTER_CREDITS = 30000;
  const BRL_PER_USD = 5.5;

  let totalMessages = 0;
  for (const cat of CATEGORIES) {
    const cfg = messages[cat.id];
    if (cfg?.enabled) {
      totalMessages += Math.floor(GAME_DURATION_S / cfg.cooldownSeconds);
    }
  }

  const totalChars = totalMessages * AVG_CHARS_PER_MSG;
  const estimatedCredits = totalChars;
  const costUSD = (estimatedCredits / ELEVENLABS_STARTER_CREDITS) * ELEVENLABS_STARTER_USD;
  const costBRL = costUSD * BRL_PER_USD;

  return {
    estimatedCredits,
    costBRL,
  };
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m${String(remainingSeconds).padStart(2, "0")}s`;
}

interface MessagesContentProps {
  config: FerroConfig;
  isElevenLabs: boolean;
  elevenLabsUsageSummary?: ElevenLabsUsageSummary | null;
  onToggle: (id: string) => void;
  onSetCooldown: (id: string, value: number) => void;
  onSetMessageMode: (mode: MessageMode) => void;
}

export function MessagesContent({
  config,
  isElevenLabs,
  elevenLabsUsageSummary,
  onToggle,
  onSetCooldown,
  onSetMessageMode,
}: MessagesContentProps) {
  const theoreticalEstimate = estimateTheoreticalCost(config.messages);
  const usageEstimate = elevenLabsUsageSummary ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Mensagens do Coach
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Escolha o que você quer ouvir durante a partida
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>
            Modo global
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Esse modo muda prompt, fallbacks, matchup e saudação inicial.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {MESSAGE_MODE_OPTIONS.map((mode) => {
            const active = config.coach.messageMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onSetMessageMode(mode.id)}
                className="card-glass text-left px-5 py-4 transition"
                style={{
                  borderColor: active ? "var(--accent-blue)" : undefined,
                  boxShadow: active ? "0 0 0 1px var(--accent-blue)" : undefined,
                }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {mode.label}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {mode.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {isElevenLabs && (
        <div
          className="card-glass flex items-center gap-3 p-4"
          style={{ borderColor: "rgba(245, 166, 35, 0.2)" }}
        >
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-orange)" }}>
              ElevenLabs selecionado
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {usageEstimate
                ? `Última partida: ~${INTEGER_FORMATTER.format(usageEstimate.estimatedCredits)} créditos (~R$ ${BRL_FORMATTER.format(usageEstimate.costBRL)})`
                : `Estimativa teórica: ~${INTEGER_FORMATTER.format(theoreticalEstimate.estimatedCredits)} créditos (~R$ ${BRL_FORMATTER.format(theoreticalEstimate.costBRL)})`}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {usageEstimate
                ? `Baseado no log mais recente: ${usageEstimate.ttsCount} falas em ${formatDuration(usageEstimate.durationSeconds)}.`
                : "Sem log recente do ElevenLabs. Mostrando só a projeção pelo cooldown."}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {CATEGORIES.map((cat) => {
          const cfg = config.messages[cat.id] ?? { enabled: true, cooldownSeconds: 30 };
          return (
            <div key={cat.id} className="card-glass flex items-center gap-4 px-5 py-4">
              <button
                role="switch"
                aria-checked={cfg.enabled}
                onClick={() => onToggle(cat.id)}
                className="toggle-track"
              >
                <span className="toggle-thumb" />
              </button>

              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: cfg.enabled ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {cat.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {cat.desc}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={cfg.cooldownSeconds}
                  onChange={(e) => onSetCooldown(cat.id, parseInt(e.target.value) || 5)}
                  className="input-field w-16 text-center text-xs"
                  disabled={!cfg.enabled}
                  style={{ opacity: cfg.enabled ? 1 : 0.4 }}
                />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  seg
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Messages() {
  const [config, setConfig] = useState<FerroConfig | null>(null);
  const [elevenLabsUsageSummary, setElevenLabsUsageSummary] = useState<ElevenLabsUsageSummary | null>(null);

  useEffect(() => {
    window.ferroAPI.getConfig().then((c) => setConfig(c as FerroConfig));
    window.ferroAPI.getElevenLabsUsageSummary().then((summary) => {
      setElevenLabsUsageSummary((summary as ElevenLabsUsageSummary | null) ?? null);
    });
    const unsub = window.ferroAPI.onConfigChanged(() => {
      window.ferroAPI.getConfig().then((c) => setConfig(c as FerroConfig));
    });
    return unsub;
  }, []);

  if (!config) return null;

  const isElevenLabs = config.tts.activeProvider === "elevenlabs";

  const toggle = async (id: string) => {
    const current = config.messages[id];
    const newEnabled = !current.enabled;
    setConfig((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      clone.messages[id] = { ...clone.messages[id], enabled: newEnabled };
      return clone;
    });
    await window.ferroAPI.setConfig(`messages.${id}.enabled`, newEnabled);
  };

  const setCooldown = async (id: string, value: number) => {
    if (value < 5) value = 5;
    if (value > 600) value = 600;
    setConfig((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      clone.messages[id] = { ...clone.messages[id], cooldownSeconds: value };
      return clone;
    });
    await window.ferroAPI.setConfig(`messages.${id}.cooldownSeconds`, value);
  };

  const setMessageMode = async (mode: MessageMode) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      clone.coach.messageMode = mode;
      return clone;
    });
    await window.ferroAPI.setConfig("coach.messageMode", mode);
  };

  return (
    <MessagesContent
      config={config}
      isElevenLabs={isElevenLabs}
      elevenLabsUsageSummary={elevenLabsUsageSummary}
      onToggle={toggle}
      onSetCooldown={setCooldown}
      onSetMessageMode={setMessageMode}
    />
  );
}

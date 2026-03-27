import { useEffect, useState } from "react";
import type {
  ElevenLabsUsageSummary,
  FerroConfig,
  MessageCategoryConfig,
  MessageMode,
} from "../../shared/types";

type MessageCategoryId =
  | "objetivo"
  | "torre"
  | "torrePerdida"
  | "morteJogador"
  | "morteStreak"
  | "itemFechado"
  | "inimigoItem"
  | "powerspike"
  | "mapa"
  | "inimigoFed"
  | "inimigoBuild"
  | "ouroParado"
  | "levelUp"
  | "inibidor"
  | "generico";

interface MessageCategoryDefinition {
  id: MessageCategoryId;
  label: string;
  desc: string;
}

interface MessageGroupDefinition {
  id: string;
  title: string;
  desc: string;
  categories: MessageCategoryId[];
}

interface MessagePresetDefinition {
  id: string;
  label: string;
  desc: string;
  config: Record<MessageCategoryId, MessageCategoryConfig>;
}

const CATEGORY_DEFINITIONS: MessageCategoryDefinition[] = [
  { id: "objetivo", label: "Objetivos", desc: "Dragão, Barão, Arauto e Vastilarvas." },
  { id: "torre", label: "Torres inimigas", desc: "Avisa quando uma torre inimiga cai." },
  { id: "torrePerdida", label: "Torres perdidas", desc: "Avisa quando sua equipe perde torre." },
  { id: "morteJogador", label: "Mortes", desc: "Alerta quando você morre." },
  { id: "morteStreak", label: "Sequência de mortes", desc: "Detecta sequência de mortes para frear tilt." },
  { id: "itemFechado", label: "Itens", desc: "Informa item importante concluído." },
  { id: "inimigoItem", label: "Itens inimigos", desc: "Inimigo comprou item perigoso ou de counter." },
  { id: "powerspike", label: "Powerspike", desc: "Pico de poder detectado." },
  { id: "mapa", label: "Minimapa", desc: "Lembretes para checar o minimapa." },
  { id: "inimigoFed", label: "Inimigo fed", desc: "Inimigo alimentado e perigoso." },
  { id: "inimigoBuild", label: "Build inimiga", desc: "Inimigo acelerou a build." },
  { id: "ouroParado", label: "Ouro parado", desc: "Ouro acumulado sem gastar." },
  { id: "levelUp", label: "Level up", desc: "Nível 6, 11 ou 16 atingido." },
  { id: "inibidor", label: "Inibidor", desc: "Inibidor destruído." },
  { id: "generico", label: "Genérico", desc: "Outras mensagens de contexto do coach." },
];

const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_DEFINITIONS.map((category) => [category.id, category])
) as Record<MessageCategoryId, MessageCategoryDefinition>;

const MESSAGE_GROUPS: MessageGroupDefinition[] = [
  {
    id: "objetivos",
    title: "Objetivos",
    desc: "Avisos de mapa e estrutura para não perder janelas importantes.",
    categories: ["objetivo", "torre", "torrePerdida", "inibidor"],
  },
  {
    id: "mapa",
    title: "Mapa",
    desc: "Leituras de rota, tempo de jogo e lembretes de presença.",
    categories: ["mapa", "levelUp", "generico"],
  },
  {
    id: "risco",
    title: "Risco",
    desc: "Alertas quando a partida começa a sair do controle.",
    categories: ["morteJogador", "morteStreak", "inimigoFed", "inimigoBuild"],
  },
  {
    id: "economia",
    title: "Economia",
    desc: "Falas sobre spikes, itens e eficiência de recurso.",
    categories: ["itemFechado", "inimigoItem", "powerspike", "ouroParado"],
  },
];

const ADJUSTABLE_CATEGORIES = new Set<MessageCategoryId>(["objetivo", "mapa"]);

const DEFAULT_MESSAGE_CONFIG: Record<MessageCategoryId, MessageCategoryConfig> = {
  objetivo: { enabled: true, cooldownSeconds: 15 },
  torre: { enabled: true, cooldownSeconds: 30 },
  torrePerdida: { enabled: true, cooldownSeconds: 30 },
  morteJogador: { enabled: true, cooldownSeconds: 90 },
  morteStreak: { enabled: true, cooldownSeconds: 180 },
  itemFechado: { enabled: true, cooldownSeconds: 30 },
  inimigoItem: { enabled: true, cooldownSeconds: 60 },
  powerspike: { enabled: true, cooldownSeconds: 60 },
  mapa: { enabled: true, cooldownSeconds: 50 },
  inimigoFed: { enabled: true, cooldownSeconds: 120 },
  inimigoBuild: { enabled: true, cooldownSeconds: 120 },
  ouroParado: { enabled: true, cooldownSeconds: 120 },
  levelUp: { enabled: true, cooldownSeconds: 30 },
  inibidor: { enabled: true, cooldownSeconds: 60 },
  generico: { enabled: true, cooldownSeconds: 30 },
};

export const MESSAGE_MODE_OPTIONS: Array<{ id: MessageMode; label: string; desc: string }> = [
  { id: "serio", label: "Sério", desc: "Tom direto, limpo e focado em execução." },
  { id: "meme", label: "Meme", desc: "Tom leve e provocativo, com humor durante a partida." },
  { id: "puto", label: "Puto", desc: "Tom agressivo, cobrança alta e pressão constante." },
];

const MODE_PREVIEWS: Record<MessageMode, string[]> = {
  serio: [
    "Olha o minimapa.",
    "Tristana está muito forte. Evita confronto direto.",
    "Muito ouro guardado. Volta pra base e gasta.",
    "Caiu torre inimiga no bot, aproveita prioridade."
  ],
  meme: [
    "Mapa não é enfeite, dá uma olhada aí.",
    "Tristana virou chefão. Não vira conteúdo pra ele não.",
    "Esse ouro parado tá fazendo cosplay de decoração.",
    "Caiu torre do bot. Agora gira antes que o jogo lembre de te punir."
  ],
  puto: [
    "Olha a porra do minimapa.",
    "Tristana tá forte pra caralho. Não peita sozinho.",
    "Tá com ouro parado pra caralho. Volta base e compra item.",
    "Caiu torre inimiga no bot. Roda logo e pressiona essa merda."
  ]
};

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function createPresetConfig(
  overrides: Partial<Record<MessageCategoryId, Partial<MessageCategoryConfig>>>
): Record<MessageCategoryId, MessageCategoryConfig> {
  const next = Object.fromEntries(
    Object.entries(DEFAULT_MESSAGE_CONFIG).map(([id, config]) => [
      id,
      { ...config },
    ])
  ) as Record<MessageCategoryId, MessageCategoryConfig>;

  for (const [id, override] of Object.entries(overrides) as Array<
    [MessageCategoryId, Partial<MessageCategoryConfig>]
  >) {
    next[id] = { ...next[id], ...override };
  }

  return next;
}

const MESSAGE_PRESETS: MessagePresetDefinition[] = [
  {
    id: "essencial",
    label: "Essencial",
    desc: "Cobertura mínima para manter foco em objetivo, risco e mapa.",
    config: createPresetConfig({
      objetivo: { cooldownSeconds: 20 },
      mapa: { cooldownSeconds: 70 },
      torre: { enabled: false },
      torrePerdida: { enabled: false },
      itemFechado: { enabled: false },
      inimigoItem: { enabled: false },
      levelUp: { enabled: false },
      generico: { enabled: false },
    }),
  },
  {
    id: "equilibrado",
    label: "Equilibrado",
    desc: "Mantém bom contexto com menor ruído.",
    config: createPresetConfig({
      objetivo: { cooldownSeconds: 18 },
      mapa: { cooldownSeconds: 60 },
      torrePerdida: { enabled: false },
      inimigoBuild: { enabled: false },
      levelUp: { enabled: false },
      generico: { enabled: false },
    }),
  },
  {
    id: "agressivo",
    label: "Agressivo",
    desc: "Volume alto com cooldowns menores para leitura constante.",
    config: createPresetConfig({
      objetivo: { cooldownSeconds: 12 },
      torre: { cooldownSeconds: 24 },
      torrePerdida: { cooldownSeconds: 24 },
      itemFechado: { cooldownSeconds: 25 },
      inimigoItem: { cooldownSeconds: 45 },
      powerspike: { cooldownSeconds: 45 },
      mapa: { cooldownSeconds: 40 },
      inimigoFed: { cooldownSeconds: 90 },
      inimigoBuild: { cooldownSeconds: 90 },
      ouroParado: { cooldownSeconds: 90 },
      levelUp: { cooldownSeconds: 25 },
      inibidor: { cooldownSeconds: 45 },
      generico: { cooldownSeconds: 25 },
    }),
  },
];

function getResolvedMessages(
  messages: FerroConfig["messages"]
): Record<MessageCategoryId, MessageCategoryConfig> {
  return Object.fromEntries(
    CATEGORY_DEFINITIONS.map((category) => [
      category.id,
      messages[category.id] ?? DEFAULT_MESSAGE_CONFIG[category.id],
    ])
  ) as Record<MessageCategoryId, MessageCategoryConfig>;
}

function estimateTheoreticalCost(messages: Record<MessageCategoryId, MessageCategoryConfig>) {
  const GAME_DURATION_S = 1800;
  const AVG_CHARS_PER_MSG = 75;
  const ELEVENLABS_STARTER_USD = 5;
  const ELEVENLABS_STARTER_CREDITS = 30000;
  const BRL_PER_USD = 5.5;

  let totalMessages = 0;
  for (const category of CATEGORY_DEFINITIONS) {
    const config = messages[category.id];
    if (config.enabled) {
      totalMessages += Math.floor(GAME_DURATION_S / config.cooldownSeconds);
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

function countEnabled(messages: Record<MessageCategoryId, MessageCategoryConfig>): number {
  return Object.values(messages).filter((config) => config.enabled).length;
}

function isElevenLabsConfigured(config: FerroConfig): boolean {
  return (
    config.tts.activeProvider === "elevenlabs" &&
    config.tts.providers.elevenlabs.apiKey.trim().length > 0 &&
    config.tts.providers.elevenlabs.voiceId.trim().length > 0
  );
}

function isPresetActive(
  messages: Record<MessageCategoryId, MessageCategoryConfig>,
  preset: Record<MessageCategoryId, MessageCategoryConfig>
): boolean {
  return CATEGORY_DEFINITIONS.every((category) => {
    const current = messages[category.id];
    const target = preset[category.id];
    return current.enabled === target.enabled && current.cooldownSeconds === target.cooldownSeconds;
  });
}

interface MessagesContentProps {
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
                <div className="mt-3 card-glass p-4 space-y-2">
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
                      window.ferroAPI.testTTS(config.tts.activeProvider, phrase);
                    }}
                  >
                    Ouvir exemplo
                  </button>
                </div>
                {config.llm.activeProvider !== "none" && (
                  <div className="mt-3 card-glass p-4 space-y-2">
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
                            const result = await (window.ferroAPI as any).testLLMCoaching();
                            if (result.ok) {
                              setLlmExample({ message: result.message, llmMs: result.llmMs });
                            } else {
                              setLlmError(result.error);
                            }
                          } catch (e) {
                            setLlmError((e as Error).message);
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
                          onClick={() => window.ferroAPI.testTTS(config.tts.activeProvider, llmExample.message)}
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
            <StatCard
              label="Modo atual"
              value={activeMode.label}
              accent="purple"
              detail={activeMode.desc}
            />
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

const ACCENT_COLORS = {
  blue: { glow: "var(--glow-blue)", rgb: "91, 139, 245" },
  purple: { glow: "var(--glow-purple)", rgb: "124, 91, 245" },
  cyan: { glow: "var(--glow-cyan)", rgb: "77, 212, 230" },
} as const;

function StatCard({
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
            <circle
              cx="18" cy="18" r="15"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15"
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

function MessageGroupCard({
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

export default function Messages() {
  const [config, setConfig] = useState<FerroConfig | null>(null);
  const [elevenLabsUsageSummary, setElevenLabsUsageSummary] = useState<ElevenLabsUsageSummary | null>(null);

  useEffect(() => {
    window.ferroAPI.getConfig().then((currentConfig) => setConfig(currentConfig as FerroConfig));
    window.ferroAPI.getElevenLabsUsageSummary().then((summary) => {
      setElevenLabsUsageSummary((summary as ElevenLabsUsageSummary | null) ?? null);
    });
    const unsub = window.ferroAPI.onConfigChanged(() => {
      window.ferroAPI.getConfig().then((currentConfig) => setConfig(currentConfig as FerroConfig));
    });
    return unsub;
  }, []);

  if (!config) return null;

  const messages = getResolvedMessages(config.messages);

  const updateMessages = async (nextMessages: Record<MessageCategoryId, MessageCategoryConfig>) => {
    const mergedMessages = {
      ...config.messages,
      ...nextMessages,
    };

    setConfig((prev) => {
      if (!prev) return prev;
      const clone = structuredClone(prev);
      clone.messages = mergedMessages;
      return clone;
    });

    await window.ferroAPI.setConfig("messages", mergedMessages);
  };

  const toggle = async (id: MessageCategoryId) => {
    await updateMessages({
      ...messages,
      [id]: {
        ...messages[id],
        enabled: !messages[id].enabled,
      },
    });
  };

  const setCooldown = async (id: MessageCategoryId, value: number) => {
    const nextValue = Math.min(600, Math.max(5, value));
    await updateMessages({
      ...messages,
      [id]: {
        ...messages[id],
        cooldownSeconds: nextValue,
      },
    });
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

  const applyPreset = async (presetMessages: Record<MessageCategoryId, MessageCategoryConfig>) => {
    await updateMessages(presetMessages);
  };

  return (
    <MessagesContent
      config={config}
      messages={messages}
      elevenLabsUsageSummary={elevenLabsUsageSummary}
      onToggle={toggle}
      onSetCooldown={setCooldown}
      onSetMessageMode={setMessageMode}
      onApplyPreset={applyPreset}
    />
  );
}

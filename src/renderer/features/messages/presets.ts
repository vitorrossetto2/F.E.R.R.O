import type { MessageCategoryConfig } from "../../../shared/types";
import { DEFAULT_MESSAGE_CONFIG } from "./constants";
import type { MessageCategoryId, MessagePresetDefinition } from "./types";

export function createPresetConfig(
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

export const MESSAGE_PRESETS: MessagePresetDefinition[] = [
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

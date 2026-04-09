import type {
  MessageCategoryConfig,
  MessageMode,
} from "../../../shared/types";
import type {
  MessageCategoryDefinition,
  MessageCategoryId,
  MessageGroupDefinition,
} from "./types";

export const CATEGORY_DEFINITIONS: MessageCategoryDefinition[] = [
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

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORY_DEFINITIONS.map((category) => [category.id, category])
) as Record<MessageCategoryId, MessageCategoryDefinition>;

export const MESSAGE_GROUPS: MessageGroupDefinition[] = [
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

export const ADJUSTABLE_CATEGORIES = new Set<MessageCategoryId>(["objetivo", "mapa"]);

export const DEFAULT_MESSAGE_CONFIG: Record<MessageCategoryId, MessageCategoryConfig> = {
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

export const MODE_PREVIEWS: Record<MessageMode, string[]> = {
  serio: [
    "Olha o minimapa.",
    "Tristana está muito forte. Evita confronto direto.",
    "Muito ouro guardado. Volta pra base e gasta.",
    "Caiu torre inimiga no bot, aproveita prioridade.",
  ],
  meme: [
    "Mapa não é enfeite, dá uma olhada aí.",
    "Tristana virou chefão. Não vira conteúdo pra ele não.",
    "Esse ouro parado tá fazendo cosplay de decoração.",
    "Caiu torre do bot. Agora gira antes que o jogo lembre de te punir.",
  ],
  puto: [
    "Olha a porra do minimapa.",
    "Tristana tá forte pra caralho. Não peita sozinho.",
    "Tá com ouro parado pra caralho. Volta base e compra item.",
    "Caiu torre inimiga no bot. Roda logo e pressiona essa merda.",
  ],
};

export const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const ACCENT_COLORS = {
  blue: { glow: "var(--glow-blue)", rgb: "91, 139, 245" },
  purple: { glow: "var(--glow-purple)", rgb: "124, 91, 245" },
  cyan: { glow: "var(--glow-cyan)", rgb: "77, 212, 230" },
} as const;

import type { MessageMode } from "../shared/types";
import { settings } from "./config";

type PhraseSet = Record<string, string[]>;
type MessageModeProfile = {
  label: string;
  systemStyle: string[];
  matchupStyle: string[];
  phrases: PhraseSet;
};

export const MESSAGE_MODES: MessageMode[] = ["serio", "meme", "puto"];

const SYSTEM_PROMPT_INTRO = [
  "Você é um coach de League of Legends em PT-BR.",
  "Dê uma dica curta e direta baseada no estado do jogo.",
  "A resposta será lida em voz alta por TTS."
];

const SYSTEM_PROMPT_FIXED_RULES = [
  "- Máximo 1 frase completa, até 15 palavras.",
  "- A frase DEVE terminar com ponto final. Nunca termine com preposição ou artigo.",
  "- Use apenas português. Troque termos ingleses: build→itens, side→lateral, push→empurrar, reset→voltar pra base, split→dividir, gank→emboscada, fed→forte.",
  "- Acentuação correta (dragão, barão, você, está).",
  "- Sem markdown, emojis, listas ou abreviações.",
  "- NUNCA sugira ir atrás de um objetivo que está morto ou em cooldown.",
  "- Só mencione dragão/barão/arauto se estiver 'disponível' nos Objetivos.",
  "- Se não tiver nada útil, responda SILENCIO."
];

const MATCHUP_PROMPT_INTRO = [
  "Você é um coach de League of Legends em PT-BR.",
  "O jogador acabou de entrar na partida. Dê uma dica sobre a matchup.",
  "A resposta será lida em voz alta por TTS."
];

const MATCHUP_PROMPT_FIXED_RULES = [
  "- Máximo 2 frases, até 25 palavras no total.",
  "- Primeira frase: dica principal da matchup (o que tomar cuidado ou como ganhar).",
  "- Segunda frase: quando lutar ou quando evitar luta.",
  "- Use apenas português. Sem termos em inglês.",
  "- Cada frase DEVE terminar com ponto final.",
  "- Sem markdown, emojis, listas ou abreviações.",
  "- Acentuação correta."
];

const SERIO_PHRASES: PhraseSet = {
  mapa: [
    "Olha o minimapa.",
    "Dá uma olhada no mapa.",
    "Checa o minimapa.",
    "Não esquece de olhar o mapa.",
    "Olho no mapa."
  ],

  ouroParado: [
    "Você está com muito ouro parado. Pensa em voltar pra base.",
    "Muito ouro guardado. Volta pra base e gasta.",
    "Ouro acumulando. Hora de dar um reset."
  ],

  inimigoFed: [
    "{name} está muito forte. Cuidado com a força {pronoun}.",
    "{name} tá carregando o jogo. Evita lutar contra.",
    "{name} está fed. Não enfrenta sozinho."
  ],

  inimigoBuild: [
    "{name} acelerou os itens. Respeita a força {pronoun}.",
    "{name} fechou item forte. Cuidado com a força {pronoun}."
  ],

  powerspike: [
    "Você bateu powerspike de {count}. Aproveita pra forçar.",
    "Powerspike de {count} atingido. Hora de pressionar."
  ],

  torreGenerica: [
    "Caiu torre inimiga no {lane}, aproveita prioridade para rotacionar.",
    "Torre inimiga do {lane} caiu, abre o mapa e pressiona.",
    "Derrubaram torre no {lane}, usa a vantagem pra avançar."
  ],

  torreMid: [
    "Caiu torre inimiga do mid, abre mapa para rotação e visão profunda."
  ],

  torreTopDragao: [
    "Caiu torre inimiga no top, usa tempo para preparar o dragão."
  ],

  torreBotBarao: [
    "Caiu torre inimiga no bot, segura wave e pensa no setup de barão."
  ],

  torrePerdidaGenerica: [
    "Perdemos torre no {lane}. Cuidado com a pressão inimiga.",
    "Torre aliada do {lane} caiu. Joga mais recuado.",
    "Caiu nossa torre no {lane}. Não entra sozinho."
  ],

  torrePerdidaMid: [
    "Perdemos torre do mid. Toma cuidado com rotas inimigas."
  ],

  torrePerdidaTop: [
    "Perdemos torre do top. Cuidado com a pressão lateral."
  ],

  torrePerdidaBot: [
    "Perdemos torre do bot. Fica atento ao dragão."
  ],

  morteJogador: [
    "Cuidado com {name}, evita ficar sozinho contra.",
    "Toma cuidado com {name}. Joga perto do time."
  ],

  morteStreak: [
    "Você morreu {count} vezes, joga mais seguro e perto do time.",
    "Muitas mortes. Reseta a cabeça e joga safe."
  ],

  itemFechado: [
    "Você fechou {item}. Ficou mais forte.",
    "{item} concluído. Aproveita o powerspike."
  ],

  inimigoItemPerigoso: [
    "{name} fechou {item}. Cuidado, ficou mais forte.",
    "{name} completou {item}. Respeita a força."
  ],

  inimigoAntiCura: [
    "Inimigo comprou anti-cura. Sua sustain caiu."
  ],

  inimigoArmadura: [
    "Inimigo tá comprando armadura. Seu dano físico vai cair."
  ],

  inimigoResistMagica: [
    "Inimigo comprando resistência mágica. Seu dano mágico vai cair."
  ],

  ultDisponivel: [
    "Nível 6. Sua ult tá disponível, procura uma chance de forçar.",
    "Bateu nível 6, ult liberada. Hora de pressionar."
  ],

  inimigoUltAntes: [
    "{name} bateu nível 6 antes de você. Cuidado com a ult.",
    "{name} tem ult e você não. Joga recuado até upar."
  ],

  levelUpChave: [
    "Nível {level} atingido. Ficou mais forte agora."
  ],

  inicioPartida: [
    "Beleza, começou a partida. Bora jogar."
  ],

  inibidorInimigo: [
    "Pegamos inibidor. Mantém a pressão.",
    "Inibidor inimigo destruído. Aproveita os super minions."
  ],

  inibidorPerdido: [
    "Perdemos inibidor. Defende a base e espera oportunidade.",
    "Inibidor aliado caiu. Segura a onda e não força."
  ],

  vitoriaPartida: [
    "Vitória. Boa partida."
  ],

  derrotaPartida: [
    "Derrota. Faz parte, próxima a gente ganha."
  ]
};

const MEME_PHRASES: PhraseSet = {
  mapa: [
    "Mapa não é enfeite, dá uma olhada aí.",
    "Confere o minimapa antes de virar clipe de erro.",
    "Olha o mapa, pelo amor do LP."
  ],

  ouroParado: [
    "Esse ouro parado tá fazendo cosplay de decoração. Volta base e gasta.",
    "Tá juntando ouro pra abrir banco. Reseta e compra item.",
    "O bolso tá cheio e o inventário triste. Base agora."
  ],

  inimigoFed: [
    "{name} virou chefão. Não vira conteúdo pra ele não.",
    "{name} tá gigante. Se respeita e não peita sozinho.",
    "{name} tá solando geral. Não entrega highlight de graça."
  ],

  inimigoBuild: [
    "{name} turboou os itens. Respeita a força {pronoun}.",
    "{name} montou build de patrão. Vai na manha e respeita."
  ],

  powerspike: [
    "Powerspike de {count} na conta. Hora de cobrar aluguel do mapa.",
    "Você ficou forte com {count}. Agora pisa sem dormir no ponto."
  ],

  torreGenerica: [
    "Caiu torre inimiga no {lane}. Abre o mapa e faz bagunça organizada.",
    "Torre do {lane} caiu. Agora gira antes que o jogo lembre de te punir."
  ],

  torreMid: [
    "Caiu a torre do mid. O mapa abriu igual porta de shopping."
  ],

  torreBotBarao: [
    "Caiu torre inimiga no bot. Segura a wave e chama o barão pro rolê."
  ],

  torrePerdidaGenerica: [
    "Perdemos torre no {lane}. Sem heroísmo de TikTok agora.",
    "Nossa torre do {lane} caiu. Joga recuado e para de inventar."
  ],

  torrePerdidaMid: [
    "Perdemos a torre do mid. Agora qualquer passeio inimigo vira problema."
  ],

  torrePerdidaTop: [
    "Perdemos torre do top. Respeita a lateral antes de virar meme."
  ],

  torrePerdidaBot: [
    "Perdemos torre do bot. Fica esperto com o dragão, gênio."
  ],

  morteJogador: [
    "Cuidado com {name}. Não vira episódio repetido contra {name}.",
    "Respeita {name} e joga colado no time."
  ],

  morteStreak: [
    "Você morreu {count} vezes. Fecha a torneira e joga safe.",
    "Já deu de morrer. Respira e cola no time."
  ],

  itemFechado: [
    "Você fechou {item}. Agora dá pra falar mais grosso.",
    "{item} pronto. Tá liberado bater com confiança."
  ],

  inimigoItemPerigoso: [
    "{name} fechou {item}. Não testa a ciência agora.",
    "{name} completou {item}. Respeita antes de virar piada."
  ],

  inimigoAntiCura: [
    "Compraram anti-cura. Sua cura foi de base sem avisar."
  ],

  inimigoArmadura: [
    "Inimigo tá de armadura. Seu dano físico vai bater fofo."
  ],

  inimigoResistMagica: [
    "Inimigo fechando resistência mágica. Sua magia vai bater de pantufa."
  ],

  ultDisponivel: [
    "Nível 6. A ult chegou, então para de economizar botão."
  ],

  inimigoUltAntes: [
    "{name} pegou ult antes. Joga pianinho até empatar.",
    "{name} tá com ult e você não. Sem gracinha agora."
  ],

  levelUpChave: [
    "Nível {level} na conta. Agora você tem licença pra pressionar."
  ],

  inicioPartida: [
    "Partida começou. Bora fingir que a solo queue faz sentido."
  ],

  inibidorInimigo: [
    "Pegamos inibidor. Agora mantém a pressão e não faz fanfic.",
    "Inibidor inimigo caiu. Usa os super minions sem dormir no ponto."
  ],

  inibidorPerdido: [
    "Perdemos inibidor. Defende a base e para de forçar milagre.",
    "Inibidor aliado caiu. Segura a onda e joga com cérebro."
  ],

  vitoriaPartida: [
    "Vitória. Hoje o caos trabalhou a seu favor."
  ],

  derrotaPartida: [
    "Derrota. Solo queue sendo solo queue."
  ]
};

const PUTO_PHRASES: PhraseSet = {
  mapa: [
    "Olha a porra do minimapa.",
    "Mapa existe, caralho. Usa.",
    "Confere o minimapa agora."
  ],

  ouroParado: [
    "Tá com ouro parado pra caralho. Volta base e compra item.",
    "Para de passear com esse ouro no bolso. Reseta agora.",
    "Esse ouro parado não bate sozinho. Base e gasta."
  ],

  inimigoFed: [
    "{name} tá forte pra caralho. Não peita sozinho.",
    "{name} tá gigante. Respeita a força {pronoun}.",
    "{name} virou problema. Para de dar luta de graça."
  ],

  inimigoBuild: [
    "{name} acelerou os itens. Respeita essa porra.",
    "{name} fechou item forte. Não testa a força {pronoun}."
  ],

  powerspike: [
    "Powerspike de {count}. Agora pisa, porra.",
    "Você ficou forte com {count}. Vai pra frente direito."
  ],

  torreGenerica: [
    "Caiu torre inimiga no {lane}. Roda logo e pressiona essa merda.",
    "Torre do {lane} caiu. Usa a vantagem sem enrolar."
  ],

  torreMid: [
    "Caiu a torre do mid. Abre o mapa e invade essa porra."
  ],

  torreTopDragao: [
    "Caiu torre inimiga no top. Aproveita e prepara o dragão direito."
  ],

  torrePerdidaGenerica: [
    "Perdemos torre no {lane}. Para de andar sozinho.",
    "Nossa torre do {lane} caiu. Recuar não é pecado."
  ],

  torrePerdidaMid: [
    "Perdemos a torre do mid. Agora qualquer rotação inimiga fode o mapa."
  ],

  torrePerdidaTop: [
    "Perdemos torre do top. Segura a lateral e para de vacilar."
  ],

  torrePerdidaBot: [
    "Perdemos torre do bot. Se liga no dragão e fecha a cara."
  ],

  morteJogador: [
    "Cuidado com {name}. Para de dar mole pra {name}.",
    "Respeita {name} e joga com o time."
  ],

  morteStreak: [
    "Você morreu {count} vezes. Chega dessa merda e joga seguro.",
    "Morreu demais. Para de se entregar e cola no time."
  ],

  itemFechado: [
    "Você fechou {item}. Agora usa essa porra.",
    "{item} pronto. Bora bater direito."
  ],

  inimigoItemPerigoso: [
    "{name} fechou {item}. Respeita essa merda.",
    "{name} completou {item}. Não entra torto agora."
  ],

  inimigoAntiCura: [
    "Compraram anti-cura. Sua sustain foi pro caralho."
  ],

  inimigoArmadura: [
    "Inimigo tá empilhando armadura. Seu dano físico vai murchar."
  ],

  inimigoResistMagica: [
    "Inimigo tá de resistência mágica. Sua magia vai bater fofo."
  ],

  ultDisponivel: [
    "Nível 6. Sua ult tá pronta, então usa direito."
  ],

  inimigoUltAntes: [
    "{name} pegou ult antes. Segura essa porra até upar.",
    "{name} tá com ult e você não. Recuar agora é obrigatório."
  ],

  levelUpChave: [
    "Nível {level}. Você ficou forte, então joga como gente."
  ],

  inicioPartida: [
    "Partida começou. Bora parar de fazer merda cedo."
  ],

  inibidorInimigo: [
    "Pegamos inibidor. Mantém a pressão e fecha essa porra.",
    "Inibidor inimigo caiu. Usa os super minions direito."
  ],

  inibidorPerdido: [
    "Perdemos inibidor. Defende a base e para de forçar merda.",
    "Inibidor aliado caiu. Segura a onda sem se afobar."
  ],

  vitoriaPartida: [
    "Vitória. Finalmente fez o básico."
  ],

  derrotaPartida: [
    "Derrota. Jogo horroroso, segue."
  ]
};

export const MESSAGE_MODE_PROFILES: Record<MessageMode, MessageModeProfile> = {
  serio: {
    label: "Sério",
    systemStyle: [
      "- Tom sério, direto e profissional.",
      "- Priorize clareza, utilidade e objetividade."
    ],
    matchupStyle: [
      "- Tom sério, direto e profissional.",
      "- Explique a matchup com clareza e sem floreio."
    ],
    phrases: SERIO_PHRASES
  },
  meme: {
    label: "Meme",
    systemStyle: [
      "- Tom brincalhão, debochado e levemente caótico.",
      "- Faça humor curto, mas a dica ainda precisa ser útil na jogada.",
      "- Não transforme a resposta em piada pura nem em bordão longo."
    ],
    matchupStyle: [
      "- Tom brincalhão e provocativo.",
      "- A dica deve soar divertida, mas continuar prática e acionável."
    ],
    phrases: MEME_PHRASES
  },
  puto: {
    label: "Puto",
    systemStyle: [
      "- Tom puto, agressivo e impaciente, sempre focado na jogada.",
      "- Pode usar palavrão leve ou médio no máximo uma vez.",
      "- Nunca use slur, ataque identitário, ameaça ou ofensa gratuita sem instrução útil."
    ],
    matchupStyle: [
      "- Tom puto e ríspido, com cobrança direta.",
      "- Pode usar palavrão leve ou médio no máximo uma vez.",
      "- Continue útil, claro e focado na matchup."
    ],
    phrases: PUTO_PHRASES
  }
};

export function normalizeMessageMode(mode: string): MessageMode {
  return mode in MESSAGE_MODE_PROFILES ? (mode as MessageMode) : "serio";
}

export function getActiveMessageMode(): MessageMode {
  return normalizeMessageMode(settings.coachMessageMode);
}

export function getMessageModeProfile(mode = settings.coachMessageMode): MessageModeProfile {
  return MESSAGE_MODE_PROFILES[normalizeMessageMode(mode)];
}

export function getPhraseSet(key: string, mode = settings.coachMessageMode): string[] {
  const normalized = normalizeMessageMode(mode);
  return MESSAGE_MODE_PROFILES[normalized].phrases[key] ?? SERIO_PHRASES[key] ?? [];
}

export function pickModePhrase(key: string, mode = settings.coachMessageMode): string {
  const variants = getPhraseSet(key, mode);
  if (variants.length === 0) return "";
  return variants[Math.floor(Math.random() * variants.length)];
}

export function buildSystemPrompt(mode = settings.coachMessageMode): string {
  const profile = getMessageModeProfile(mode);
  return [
    ...SYSTEM_PROMPT_INTRO,
    "Regras de estilo:",
    ...profile.systemStyle,
    "Regras fixas:",
    ...SYSTEM_PROMPT_FIXED_RULES
  ].join("\n");
}

export function buildMatchupPrompt(mode = settings.coachMessageMode): string {
  const profile = getMessageModeProfile(mode);
  return [
    ...MATCHUP_PROMPT_INTRO,
    "Regras de estilo:",
    ...profile.matchupStyle,
    "Regras fixas:",
    ...MATCHUP_PROMPT_FIXED_RULES
  ].join("\n");
}

export const PHRASES = SERIO_PHRASES;

export const ITEM_TAGS: Record<string, string[]> = {
  antiCura: [
    "Lembrete Mortal",
    "Morellonomicon",
    "Armadura de Espinhos",
    "Serrespada Quimiopunk"
  ],
  armadura: [
    "Coração Congelado",
    "Presságio de Randuin",
    "Armadura de Espinhos",
    "Couraça do Defunto",
    "Manopla dos Glacinatas",
    "Placa Gargolítica",
    "Jak'Sho",
    "Égide de Fogo Solar",
    "Dança da Morte"
  ],
  resistMagica: [
    "Força da Natureza",
    "Semblante Espiritual",
    "Máscara Abissal",
    "Limite da Razão",
    "Mandíbula de Malmortius",
    "Rookern Lamúrico",
    "Véu da Banshee"
  ]
};

export const CATEGORY_COOLDOWNS: Record<string, number> = {
  mapa: 50,
  ouroParado: 120,
  inimigoFed: 120,
  inimigoBuild: 120,
  powerspike: 60,
  torre: 30,
  torrePerdida: 30,
  morteJogador: 90,
  morteStreak: 180,
  objetivo: 15,
  itemFechado: 30,
  inimigoItem: 60,
  levelUp: 30,
  inibidor: 60,
  fimDeJogo: 0,
  generico: 30
};

export const FEMALE_CHAMPIONS = new Set([
  "Ahri", "Akali", "Anivia", "Annie", "Ashe", "Aurora", "Bel'Veth",
  "Briar", "Caitlyn", "Camille", "Cassiopeia", "Diana", "Elise",
  "Evelynn", "Fiora", "Gwen", "Illaoi", "Irelia", "Janna", "Jinx",
  "Kai'Sa", "Kalista", "Karma", "Katarina", "Kayle", "Kindred",
  "LeBlanc", "Leona", "Lillia", "Lissandra", "Lulu", "Lux",
  "Miss Fortune", "Morgana", "Nami", "Neeko", "Nidalee", "Nilah",
  "Orianna", "Poppy", "Qiyana", "Quinn", "Rell", "Renata Glasc",
  "Riven", "Samira", "Sejuani", "Senna", "Seraphine", "Shyvana",
  "Sivir", "Sona", "Soraka", "Syndra", "Taliyah", "Tristana",
  "Vayne", "Vi", "Xayah", "Yuumi", "Zeri", "Zoe", "Zyra"
]);

export const SYSTEM_PROMPT = buildSystemPrompt("serio");
export const MATCHUP_PROMPT = buildMatchupPrompt("serio");

export const CATEGORY_PRIORITIES: Record<string, number> = {
  objetivo: 3,
  fimDeJogo: 3,
  torre: 2,
  torrePerdida: 2,
  morteStreak: 2,
  inibidor: 2,
  powerspike: 1,
  itemFechado: 1,
  inimigoFed: 1,
  inimigoItem: 1,
  inimigoBuild: 1,
  levelUp: 1,
  morteJogador: 1,
  mapa: 0,
  ouroParado: 0,
  generico: 0,
};

export const COOLDOWN_GROUPS: Record<string, string> = {
  inimigoFed: "inimigoPerigo",
  inimigoItem: "inimigoPerigo",
  inimigoBuild: "inimigoPerigo",
};

export const GROUP_COOLDOWN_SECONDS = 180;

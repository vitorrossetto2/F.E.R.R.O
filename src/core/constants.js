// ── Frases de fallback por categoria ─────────────────────────────
// Edite aqui para mudar o que o coach fala sem precisar mexer na lógica.
// Cada array é sorteado aleatoriamente. Use {name} e {pronoun} como placeholders.

export const PHRASES = {
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
    "{name} fechou item forte. Cuidado com {pronoun}."
  ],

  powerspike: [
    "Você bateu powerspike de {count}. Aproveita pra forçar.",
    "Powerspike de {count} atingido. Hora de pressionar."
  ],

  // Torres inimigas destruídas (time avançando)
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

  // Torres aliadas destruídas (time perdendo pressão)
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

  // Itens
  itemFechado: [
    "Você fechou {item}! Ficou mais forte.",
    "{item} concluído. Aproveita o powerspike."
  ],

  inimigoItemPerigoso: [
    "{name} fechou {item}. Cuidado, ficou mais forte.",
    "{name} completou {item}. Respeita a força."
  ],

  inimigoAntiCura: [
    "Inimigo comprou anti-cura. Sua sustain caiu.",
    "Compraram anti-cura. Cuidado com trocas longas."
  ],

  inimigoArmadura: [
    "Inimigo tá comprando armadura. Seu dano físico vai cair.",
  ],

  inimigoResistMagica: [
    "Inimigo comprando resistência mágica. Seu dano mágico vai cair.",
  ],

  // Level ups
  ultDisponivel: [
    "Nível 6! Sua ult tá disponível, procura uma chance de forçar.",
    "Bateu nível 6, ult liberada. Hora de pressionar."
  ],

  inimigoUltAntes: [
    "{name} bateu nível 6 antes de você. Cuidado com a ult.",
    "{name} tem ult e você não. Joga recuado até upar."
  ],

  levelUpChave: [
    "Nível {level} atingido. Ficou mais forte agora.",
  ],

  // Eventos de jogo
  inicioPartida: [
    "Beleza, começou a partida! Bora jogar."
  ],

  inibidorInimigo: [
    "Pegamos inibidor! Mantém a pressão.",
    "Inibidor inimigo destruído. Aproveita os super minions."
  ],

  inibidorPerdido: [
    "Perdemos inibidor. Defende a base e espera oportunidade.",
    "Inibidor aliado caiu. Segura a onda e não força."
  ],

  vitoriaPartida: [
    "Vitória! Boa partida."
  ],

  derrotaPartida: [
    "Derrota. Faz parte, próxima a gente ganha."
  ]
};

// ── Itens counter por nome PT-BR (validado via ddragon 16.6.1 pt_BR) ──
// Nomes parciais — se o nome do item contém alguma dessas strings, é classificado.

export const ITEM_TAGS = {
  antiCura: [
    "Lembrete Mortal",            // 3033
    "Morellonomicon",             // 3165
    "Armadura de Espinhos",       // 3075
    "Serrespada Quimiopunk"       // 6609
  ],
  armadura: [
    "Coração Congelado",          // 3110
    "Presságio de Randuin",       // 3143
    "Armadura de Espinhos",       // 3075
    "Couraça do Defunto",         // 3742
    "Manopla dos Glacinatas",     // 6662
    "Placa Gargolítica",          // 3193
    "Jak'Sho",                    // 6665
    "Égide de Fogo Solar",        // 3068
    "Dança da Morte"              // 6333
  ],
  resistMagica: [
    "Força da Natureza",          // 4401
    "Semblante Espiritual",       // 3065
    "Máscara Abissal",            // 8020
    "Limite da Razão",            // 3091 (Wit's End)
    "Mandíbula de Malmortius",    // 3156
    "Rookern Lamúrico",           // 2504
    "Véu da Banshee"              // 3102
  ]
};

// ── Cooldown por categoria (segundos) ────────────────────────────
// Quanto tempo mínimo entre duas mensagens da MESMA categoria.

export const CATEGORY_COOLDOWNS = {
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

// ── Campeãs femininas (para pronome dela/dele) ───────────────────

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

// ── System prompt do LLM ─────────────────────────────────────────

export const SYSTEM_PROMPT = [
  "Você é um coach de League of Legends em PT-BR.",
  "Dê uma dica curta e direta baseada no estado do jogo.",
  "A resposta será lida em voz alta por TTS.",
  "Regras:",
  "- Máximo 1 frase completa, até 15 palavras.",
  "- A frase DEVE terminar com ponto final. Nunca termine com preposição ou artigo.",
  "- Use apenas português. Troque termos ingleses: build→itens, side→lateral, push→empurrar, reset→voltar pra base, split→dividir, gank→emboscada, fed→forte.",
  "- Acentuação correta (dragão, barão, você, está).",
  "- Sem markdown, emojis, listas ou abreviações.",
  "- NUNCA sugira ir atrás de um objetivo que está morto ou em cooldown.",
  "- Só mencione dragão/barão/arauto se estiver 'disponível' nos Objetivos.",
  "- Se não tiver nada útil, responda SILENCIO."
].join("\n");

// ── Matchup prompt (usado 1x no início da partida) ──────────────

export const MATCHUP_PROMPT = [
  "Você é um coach de League of Legends em PT-BR.",
  "O jogador acabou de entrar na partida. Dê uma dica sobre a matchup.",
  "A resposta será lida em voz alta por TTS.",
  "Regras:",
  "- Máximo 2 frases, até 25 palavras no total.",
  "- Primeira frase: dica principal da matchup (o que tomar cuidado ou como ganhar).",
  "- Segunda frase: quando lutar ou quando evitar luta.",
  "- Use apenas português. Sem termos em inglês.",
  "- Cada frase DEVE terminar com ponto final.",
  "- Sem markdown, emojis, listas ou abreviações.",
  "- Acentuação correta."
].join("\n");

import OpenAI from "openai";

import { getZaiBaseUrl, settings } from "./config.js";
import {
  PHRASES,
  CATEGORY_COOLDOWNS,
  FEMALE_CHAMPIONS,
  SYSTEM_PROMPT,
  MATCHUP_PROMPT
} from "./constants.js";

function hasLlmConfig() {
  return Boolean(settings.zaiApiKey && settings.zaiEndpoint && settings.zaiModel);
}

function getClient() {
  if (!hasLlmConfig()) return null;

  return new OpenAI({
    apiKey: settings.zaiApiKey,
    baseURL: getZaiBaseUrl()
  });
}

// ── helpers ──────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genderPronoun(championName) {
  return FEMALE_CHAMPIONS.has(championName) ? "dela" : "dele";
}

function toSentence(text) {
  if (!text) return "";
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DANGLING_ENDINGS = /\s+(para|no|na|de|do|dos|das|em|o|a|os|as|e|ou|um|uma|com|por|ao|à|que|se|seu|sua|seus|suas|pelo|pela|nos|nas|num)$/i;

function isTruncated(text) {
  if (!text) return false;
  const t = text.trim();
  return t.length < 5 || DANGLING_ENDINGS.test(t);
}

// ── trigger classification ───────────────────────────────────────

const SIMPLE_TRIGGERS = new Set(["lembrete de mapa", "ouro parado alto"]);

function isSimpleTrigger(priority) {
  if (!priority) return false;
  if (SIMPLE_TRIGGERS.has(priority)) return true;
  if (priority.includes("em 1 minuto")) return true;
  if (priority.includes("em 30 segundos")) return true;
  if (priority.includes("em 10 segundos")) return true;
  if (priority.includes("nasceu agora")) return true;
  if (priority.includes("morreu, janela de")) return true;
  if (priority.startsWith("inimigo fed:")) return true;
  if (priority.includes("acelerou a build")) return true;
  if (priority.includes("powerspike")) return true;
  if (priority.includes("torre")) return true;
  if (priority.includes("você morreu")) return true;
  if (priority.includes("cuidado com")) return true;
  if (priority.includes("inibidor")) return true;
  if (priority === "vitória" || priority === "derrota") return true;
  if (priority.includes("Perdemos torre") || priority.includes("perdemos torre")) return true;
  if (priority === "ult disponível") return true;
  if (priority.startsWith("inimigo ult antes:")) return true;
  if (priority.startsWith("level up chave:")) return true;
  if (priority.startsWith("item fechado:")) return true;
  if (priority.startsWith("inimigo item:")) return true;
  if (priority.startsWith("inimigo counter")) return true;
  return false;
}

// ── category detection ───────────────────────────────────────────

export function detectCategory(priority) {
  if (!priority) return "generico";
  if (priority === "lembrete de mapa") return "mapa";
  if (priority === "ouro parado alto") return "ouroParado";
  if (priority.startsWith("inimigo fed:")) return "inimigoFed";
  if (priority.includes("acelerou a build")) return "inimigoBuild";
  if (priority.includes("powerspike")) return "powerspike";
  if (priority.includes("Perdemos torre") || priority.includes("perdemos torre") ||
      priority.includes("Torre aliada") || priority.includes("nossa torre")) return "torrePerdida";
  if (priority.includes("torre") || priority.includes("caiu torre")) return "torre";
  if (priority.includes("você morreu")) return "morteStreak";
  if (priority.includes("cuidado com")) return "morteJogador";
  if (priority === "ult disponível" || priority.startsWith("inimigo ult antes:") ||
      priority.startsWith("level up chave:")) return "levelUp";
  if (priority.startsWith("item fechado:")) return "itemFechado";
  if (priority.startsWith("inimigo item:") || priority.startsWith("inimigo counter")) return "inimigoItem";
  if (priority.includes("inibidor")) return "inibidor";
  if (priority === "vitória" || priority === "derrota") return "fimDeJogo";
  if (priority.includes("em 1 minuto") || priority.includes("em 30 segundos") ||
      priority.includes("em 10 segundos") || priority.includes("nasceu agora") ||
      priority.includes("morreu, janela de")) return "objetivo";
  return "generico";
}

export function getCategoryCooldown(category) {
  return CATEGORY_COOLDOWNS[category] ?? CATEGORY_COOLDOWNS.generico;
}

// ── heuristic / fallback ─────────────────────────────────────────

function heuristicAlert(snapshot, triggers) {
  if (triggers.length > 0) return triggers[0];

  if (snapshot.activePlayerGold >= settings.stalledGoldThreshold) {
    return "ouro parado alto";
  }

  const fedEnemies = [...snapshot.enemyPlayers]
    .filter((p) => p.kills >= 4 && p.kills - p.deaths >= 2)
    .sort((a, b) => (b.kills - b.deaths) - (a.kills - a.deaths));

  if (fedEnemies.length > 0) {
    return `inimigo fed: ${fedEnemies[0].championName}`;
  }

  return null;
}

function fallbackMessage(priority) {
  if (!priority) return "";

  if (priority === "lembrete de mapa") {
    return pick(PHRASES.mapa);
  }

  if (priority === "ouro parado alto") {
    return pick(PHRASES.ouroParado);
  }

  if (priority.startsWith("inimigo fed:")) {
    const name = priority.split(":")[1]?.trim();
    if (!name) return "";
    const pronoun = genderPronoun(name);
    return pick(PHRASES.inimigoFed).replace("{name}", name).replace("{pronoun}", pronoun);
  }

  if (priority.includes("acelerou a build")) {
    const name = priority.split(" acelerou")[0]?.trim();
    if (name) {
      const pronoun = genderPronoun(name);
      return pick(PHRASES.inimigoBuild).replace("{name}", name).replace(/\{pronoun\}/g, pronoun);
    }
  }

  if (priority.includes("powerspike")) {
    const match = priority.match(/(\d+ (?:itens|item))/);
    const count = match ? match[1] : "itens";
    return pick(PHRASES.powerspike).replace("{count}", count);
  }

  if (priority.includes("você morreu")) {
    const match = priority.match(/(\d+) vezes/);
    const count = match ? match[1] : "";
    return pick(PHRASES.morteStreak).replace("{count}", count);
  }

  if (priority.includes("cuidado com")) {
    const name = priority.replace("cuidado com ", "").split(",")[0].trim();
    return pick(PHRASES.morteJogador).replace("{name}", name);
  }

  if (priority === "ult disponível") {
    return pick(PHRASES.ultDisponivel);
  }

  if (priority.startsWith("inimigo ult antes:")) {
    const name = priority.split(":")[1]?.trim();
    if (name) return pick(PHRASES.inimigoUltAntes).replace("{name}", name);
  }

  if (priority.startsWith("level up chave:")) {
    const level = priority.split(":")[1]?.trim();
    return pick(PHRASES.levelUpChave).replace("{level}", level);
  }

  if (priority.startsWith("item fechado:")) {
    const item = priority.split(":")[1]?.trim();
    return pick(PHRASES.itemFechado).replace("{item}", item);
  }

  if (priority.startsWith("inimigo counter antiCura")) {
    return pick(PHRASES.inimigoAntiCura);
  }

  if (priority.startsWith("inimigo counter armadura")) {
    return pick(PHRASES.inimigoArmadura);
  }

  if (priority.startsWith("inimigo counter resistMagica")) {
    return pick(PHRASES.inimigoResistMagica);
  }

  if (priority.startsWith("inimigo item:")) {
    // format: "inimigo item: ChampName:ItemName"
    const after = priority.slice("inimigo item:".length).trim();
    const sepIdx = after.indexOf(":");
    if (sepIdx > 0) {
      const name = after.slice(0, sepIdx).trim();
      const item = after.slice(sepIdx + 1).trim();
      return pick(PHRASES.inimigoItemPerigoso).replace("{name}", name).replace("{item}", item);
    }
  }

  if (priority === "perdemos inibidor") {
    return pick(PHRASES.inibidorPerdido);
  }

  if (priority === "pegamos inibidor inimigo") {
    return pick(PHRASES.inibidorInimigo);
  }

  if (priority === "vitória") {
    return pick(PHRASES.vitoriaPartida);
  }

  if (priority === "derrota") {
    return pick(PHRASES.derrotaPartida);
  }

  const sentence = toSentence(priority);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

// ── prompt builder ───────────────────────────────────────────────

function compactPlayer(player) {
  return `${player.championName}(${player.kills}/${player.deaths}/${player.assists},nv${player.level})`;
}

function buildPrompt(snapshot, triggers, priority, strategicContext) {
  const allies = snapshot.alliedPlayers.map(compactPlayer).join(", ");
  const enemies = snapshot.enemyPlayers.map(compactPlayer).join(", ");

  const lines = [
    `${Math.floor(snapshot.gameTime / 60)}min | ${snapshot.activePlayerChampion} nv${snapshot.activePlayerLevel} ${snapshot.activePlayerKda} | ouro:${snapshot.activePlayerGold}`,
    `Aliados: ${allies}`,
    `Inimigos: ${enemies}`
  ];

  if (triggers.length > 0) {
    lines.push(`Gatilhos: ${triggers.join("; ")}`);
  }

  if (priority) {
    lines.push(`Prioridade: ${priority}`);
  }

  if (strategicContext?.scalingRead) {
    lines.push(`Escala: ${strategicContext.scalingRead}`);
  }

  if (strategicContext?.enemyThreat) {
    const t = strategicContext.enemyThreat;
    lines.push(`Ameaça: ${t.championName} ${t.kda} [${t.build.join(",")}]`);
  }

  if (strategicContext?.objectiveStates?.length > 0) {
    const objs = strategicContext.objectiveStates.map((o) =>
      o.available ? `${o.name}: disponível` : `${o.name}: morto (nasce em ${o.spawnIn})`
    );
    lines.push(`Objetivos: ${objs.join(" | ")}`);
  }

  return lines.join("\n");
}

// ── main decision function ───────────────────────────────────────

export async function decideCoaching(snapshot, triggers, strategicContext) {
  const priority = heuristicAlert(snapshot, triggers);
  const fallback = fallbackMessage(priority);

  if (isSimpleTrigger(priority)) {
    return {
      shouldSpeak: !!fallback,
      message: fallback,
      reason: `heurística direta: ${priority}`,
      priority,
      prompt: "",
      rawModelMessage: "",
      fallbackUsed: true,
      llmMs: 0,
      llmTokens: null,
      llmError: null,
      skippedLlm: true
    };
  }

  const hasStrategicContext =
    priority !== null ||
    triggers.length > 0 ||
    strategicContext?.objectiveStates?.some((o) => o.available);

  if (!hasStrategicContext) {
    return {
      shouldSpeak: false,
      message: "",
      reason: "sem contexto estratégico para LLM",
      priority,
      prompt: "",
      rawModelMessage: "",
      fallbackUsed: false,
      llmMs: 0,
      llmTokens: null,
      llmError: null,
      skippedLlm: true
    };
  }

  const prompt = buildPrompt(snapshot, triggers, priority, strategicContext);
  const client = getClient();

  if (!client) {
    return {
      shouldSpeak: !!fallback,
      message: fallback,
      reason: "llm desabilitada ou nao configurada",
      priority,
      prompt,
      rawModelMessage: "",
      fallbackUsed: !!fallback,
      llmMs: 0,
      llmTokens: null,
      llmError: null,
      skippedLlm: true
    };
  }

  let message = "";
  let llmMs = 0;
  let llmTokens = null;
  let llmError = null;
  const llmStart = performance.now();
  try {
    const requestBody = {
      model: settings.zaiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    };

    if (settings.zaiModel.includes("glm")) {
      requestBody.extra_body = { thinking: { enabled: false } };
    }

    const completion = await client.chat.completions.create(requestBody);
    llmMs = Math.round(performance.now() - llmStart);
    message = (completion.choices?.[0]?.message?.content ?? "").trim();
    llmTokens = completion.usage ?? null;
  } catch (error) {
    llmMs = Math.round(performance.now() - llmStart);
    llmError = error.message;
    console.error(`[Coach] LLM erro (${llmMs}ms):`, error.message);
  }

  if (message && isTruncated(message)) {
    message = "";
  }

  if (!message || message.toUpperCase() === "SILENCIO") {
    if (fallback) {
      return {
        shouldSpeak: true,
        message: fallback,
        reason: `fallback: ${priority}`,
        priority,
        prompt,
        rawModelMessage: message,
        fallbackUsed: true,
        llmMs,
        llmTokens,
        llmError,
        skippedLlm: false
      };
    }

    return {
      shouldSpeak: false,
      message: "",
      reason: priority ?? "sem evento relevante",
      priority,
      prompt,
      rawModelMessage: message,
      fallbackUsed: false,
      llmMs,
      llmTokens,
      llmError,
      skippedLlm: false
    };
  }

  return {
    shouldSpeak: true,
    message,
    reason: priority ?? "resposta do modelo",
    priority,
    prompt,
    rawModelMessage: message,
    fallbackUsed: false,
    llmMs,
    llmTokens,
    llmError,
    skippedLlm: false
  };
}

export async function getMatchupTip(snapshot) {
  const client = getClient();
  if (!client) {
    return null;
  }

  const myChamp = snapshot.activePlayerChampion;
  const enemies = snapshot.enemyPlayers.map((p) => p.championName).join(", ");

  const prompt = `Você é ${myChamp}. Inimigos: ${enemies}. Dê a dica de matchup.`;

  let message = "";
  let llmMs = 0;
  const llmStart = performance.now();
  try {
    const requestBody = {
      model: settings.zaiModel,
      messages: [
        { role: "system", content: MATCHUP_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 500
    };

    if (settings.zaiModel.includes("glm")) {
      requestBody.extra_body = { thinking: { enabled: false } };
    }

    const completion = await client.chat.completions.create(requestBody);
    llmMs = Math.round(performance.now() - llmStart);
    message = (completion.choices?.[0]?.message?.content ?? "").trim();
  } catch (error) {
    llmMs = Math.round(performance.now() - llmStart);
    console.error(`[Coach] Matchup LLM erro (${llmMs}ms):`, error.message);
  }

  if (!message || isTruncated(message)) {
    return null;
  }

  return { message, llmMs };
}

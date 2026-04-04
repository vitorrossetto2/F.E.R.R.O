import { settings } from "./config";
import {
  CATEGORY_COOLDOWNS,
  FEMALE_CHAMPIONS,
  buildMatchupPrompt,
  buildSystemPrompt,
  pickModePhrase
} from "./constants";
import { getChampionCatalog, getItemCatalog } from "./ddragon";
import { runLlmTextRequest } from "./llm";
import type { CoachDecision, GameSnapshot, MatchupTip, SnapshotPlayer, StrategicContext } from "./types";

function hasLlmConfig(): boolean {
  return Boolean(settings.zaiApiKey && settings.zaiEndpoint && settings.zaiModel);
}

type ChampionArchetype = "marksman" | "mage" | "assassin" | "fighter" | "tank" | "support" | "unknown";
type DamageFlavor = "physical" | "magic" | "mixed";
type GamePhase = "early" | "mid" | "late";

interface ItemizationAdvice {
  playerChampion: string;
  enemyChampion: string;
  enemySource: "lane" | "threat";
  playerArchetype: ChampionArchetype;
  enemyArchetype: ChampionArchetype;
  damageFlavor: DamageFlavor;
  phase: GamePhase;
  coreItemId: number | null;
  responseItemId: number | null;
  signals: string[];
}

interface EnemyCounterTarget {
  championName: string;
  archetype: ChampionArchetype;
  lane: string;
  source: "lane" | "threat";
}

const ITEM_IDS = {
  berserkers: 3006,
  platedSteelcaps: 3047,
  mercurys: 3111,
  guardianAngel: 3026,
  mortalReminder: 3033,
  ldr: 3036,
  phantomDancer: 3046,
  bloodthirster: 3072,
  blackCleaver: 3071,
  bladeOfTheRuinedKing: 3153,
  deathsDance: 6333,
  frozenHeart: 3110,
  bansheesVeil: 3102,
  trinityForce: 3078,
  spiritVisage: 3065,
  thornmail: 3075,
  sunfireAegis: 3068,
  rabadons: 3089,
  lichBane: 3100,
  nashors: 3115,
  morellonomicon: 3165,
  voidStaff: 3135,
  zhonyas: 3157,
  maw: 3156,
  mercurial: 3139,
  randuin: 3143,
  locket: 3190,
  forceOfNature: 4401,
  jakSho: 6665,
  krakenSlayer: 6672,
  infinityEdge: 3031,
  rapidFirecannon: 3094,
  youmuusGhostblade: 3142,
  gargoyleStoneplate: 3193
} as const;

const HEALING_CHAMPIONS = new Set([
  "Aatrox",
  "Dr. Mundo",
  "Fiora",
  "Gwen",
  "Illaoi",
  "Olaf",
  "Renekton",
  "Soraka",
  "Sona",
  "Swain",
  "Vladimir",
  "Warwick",
  "Yuumi",
  "Nami"
]);

function normalizeChampionKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getChampionRecord(catalog: Map<string, { name: string; tags?: string[] }>, championName: string | undefined): { name: string; tags?: string[] } | undefined {
  if (!championName) return undefined;
  const key = normalizeChampionKey(championName);
  return catalog.get(key) ?? catalog.get(normalizeChampionKey(championName.replace(/#.*$/, "")));
}

function getChampionTags(catalog: Map<string, { name: string; tags?: string[] }>, championName: string | undefined): string[] {
  return getChampionRecord(catalog, championName)?.tags ?? [];
}

function classifyChampionArchetype(
  catalog: Map<string, { name: string; tags?: string[] }>,
  championName: string | undefined,
  position: string | undefined
): ChampionArchetype {
  const tags = getChampionTags(catalog, championName);
  const lane = String(position ?? "").toUpperCase();

  if (tags.includes("Marksman")) return "marksman";
  if (tags.includes("Mage") && tags.includes("Support")) return lane === "SUPPORT" ? "support" : "mage";
  if (tags.includes("Mage")) return "mage";
  if (tags.includes("Assassin") && tags.includes("Mage")) return lane === "MID" || lane === "JUNGLE" ? "assassin" : "mage";
  if (tags.includes("Assassin")) return lane === "MID" || lane === "JUNGLE" ? "assassin" : "fighter";
  if (tags.includes("Tank") && tags.includes("Support")) return lane === "SUPPORT" ? "support" : "tank";
  if (tags.includes("Tank")) return "tank";
  if (tags.includes("Fighter")) return "fighter";
  if (tags.includes("Support")) return "support";

  if (lane === "BOTTOM") return "marksman";
  if (lane === "SUPPORT") return "support";
  if (lane === "MID") return "mage";
  if (lane === "JUNGLE") return "fighter";
  if (lane === "TOP") return "fighter";
  return "unknown";
}

function inferDamageFlavor(
  catalog: Map<string, { name: string; tags?: string[] }>,
  championName: string | undefined,
  archetype: ChampionArchetype
): DamageFlavor {
  const tags = getChampionTags(catalog, championName);
  if (archetype === "marksman") return "physical";
  if (archetype === "mage") return "magic";
  if (archetype === "tank" || archetype === "support") return "mixed";
  if (archetype === "assassin") {
    if (tags.includes("Mage")) return "magic";
    return "physical";
  }
  if (archetype === "fighter") {
    if (tags.includes("Mage")) return "magic";
    return "physical";
  }
  if (tags.includes("Mage")) return "magic";
  if (tags.includes("Marksman") || tags.includes("Fighter")) return "physical";
  return "mixed";
}

function getGamePhase(gameTimeSeconds: number): GamePhase {
  if (gameTimeSeconds < 600) return "early";
  if (gameTimeSeconds < 1500) return "mid";
  return "late";
}

function extractItemName(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const record = item as { displayName?: unknown; name?: unknown };
  const name = typeof record.displayName === "string" ? record.displayName : typeof record.name === "string" ? record.name : "";
  return name.trim();
}
function buildItemContextBlock(snapshot: GameSnapshot, strategicContext?: StrategicContext | null): string {
  const alliedPlayers = Array.isArray(snapshot.alliedPlayers) ? snapshot.alliedPlayers : [];
  const activePlayer = alliedPlayers.find((player) => player.summonerName === snapshot.activePlayerName);
  const ownedItemNames = new Set<string>();

  for (const item of activePlayer?.items ?? []) {
    const name = extractItemName(item);
    if (name) ownedItemNames.add(name);
  }

  for (const item of strategicContext?.activePlayer?.majorItemDetails ?? []) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (name) ownedItemNames.add(name);
  }

  const enemyItemNames = new Set<string>();
  for (const enemyBuild of strategicContext?.enemyBuilds ?? []) {
    for (const item of enemyBuild.majorItemDetails ?? []) {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      if (name) enemyItemNames.add(name);
    }
  }

  const laneOpponent = snapshot.enemyPlayers.find((player) => player.position === snapshot.activePlayerPosition) ?? snapshot.enemyPlayers[0];
  const threat = strategicContext?.enemyThreat ?? strategicContext?.enemyThreats?.[0] ?? null;
  const targetName = threat?.championName ?? laneOpponent?.championName ?? "desconhecido";
  const targetReason = threat ? "maior ameaca do time inimigo" : laneOpponent ? "adversario da sua lane" : "contexto geral";

  const lines = [
    `Itens do jogador: ${ownedItemNames.size > 0 ? [...ownedItemNames].join(", ") : "nenhum item importante ainda"}.`,
    `Itens visiveis do inimigo: ${enemyItemNames.size > 0 ? [...enemyItemNames].join(", ") : "nenhum item visivel ainda"}.`,
    `Alvo prioritario: ${targetName} (${targetReason}).`,
    "Nao recomende itens que o jogador ja possui.",
    "Sugira itens a partir do estado do jogo e da pressao do inimigo."
  ];

  return lines.join("\n");
}

function getItemName(itemCatalog: Map<string, { name: string }>, itemId: number | null): string | null {
  if (!itemId) return null;
  return itemCatalog.get(String(itemId))?.name ?? null;
}

function collectOwnedItemIds(snapshot: GameSnapshot, strategicContext?: StrategicContext | null): Set<number> {
  const owned = new Set<number>();
  const alliedPlayers = Array.isArray(snapshot.alliedPlayers) ? snapshot.alliedPlayers : [];
  const activePlayer = alliedPlayers.find((player) => player.summonerName === snapshot.activePlayerName);
  for (const item of activePlayer?.items ?? []) {
    if (typeof item?.id === "number") owned.add(item.id);
  }

  for (const item of strategicContext?.activePlayer?.majorItemDetails ?? []) {
    if (typeof item?.id === "number") owned.add(item.id);
  }

  return owned;
}

function isDefensiveItem(name: string): boolean {
  return /Armor|SpellBlock|Health|Visage|Heart|Thornmail|Randuin|Gargoyle|Stoneplate|Locket|Banshee|Mercurial|Guardian|Jak'Sho|Maw|Death's Dance|Warmog/i.test(name);
}

function pickFirstAvailable(owned: Set<number>, candidates: Array<number | null | undefined>): number | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "number") continue;
    if (!owned.has(candidate)) return candidate;
  }
  return null;
}

function getItemPriorityCandidates(
  archetype: ChampionArchetype,
  damageFlavor: DamageFlavor,
  phase: GamePhase,
  enemyThreat: ReturnType<typeof summarizeEnemyThreats>
): number[] {
  switch (archetype) {
    case "marksman":
      return enemyThreat.healingPressure
        ? [ITEM_IDS.mortalReminder, ITEM_IDS.ldr, ITEM_IDS.infinityEdge, ITEM_IDS.phantomDancer]
        : (enemyThreat.teamFrontlinePressure >= 2 || enemyThreat.armorPressure)
          ? [phase === "early" ? ITEM_IDS.krakenSlayer : ITEM_IDS.ldr, ITEM_IDS.infinityEdge, ITEM_IDS.phantomDancer]
          : [ITEM_IDS.berserkers, ITEM_IDS.infinityEdge, ITEM_IDS.phantomDancer, ITEM_IDS.ldr];
    case "mage":
      return damageFlavor === "magic"
        ? [phase === "early" ? ITEM_IDS.lichBane : ITEM_IDS.nashors, ITEM_IDS.rabadons, ITEM_IDS.voidStaff, ITEM_IDS.zhonyas]
        : [ITEM_IDS.nashors, ITEM_IDS.rabadons, ITEM_IDS.voidStaff, ITEM_IDS.zhonyas];
    case "assassin":
      return damageFlavor === "magic"
        ? [ITEM_IDS.lichBane, ITEM_IDS.zhonyas, ITEM_IDS.voidStaff, ITEM_IDS.bansheesVeil]
        : [ITEM_IDS.youmuusGhostblade, ITEM_IDS.deathsDance, ITEM_IDS.guardianAngel, ITEM_IDS.blackCleaver];
    case "fighter":
      return [phase === "early" ? ITEM_IDS.trinityForce : ITEM_IDS.blackCleaver, ITEM_IDS.deathsDance, ITEM_IDS.guardianAngel, ITEM_IDS.bladeOfTheRuinedKing];
    case "tank":
      return [phase === "early" ? ITEM_IDS.sunfireAegis : ITEM_IDS.jakSho, ITEM_IDS.gargoyleStoneplate, ITEM_IDS.randuin, ITEM_IDS.forceOfNature];
    case "support":
      return [ITEM_IDS.locket, ITEM_IDS.gargoyleStoneplate, ITEM_IDS.forceOfNature, ITEM_IDS.bansheesVeil];
    default:
      return [ITEM_IDS.berserkers, ITEM_IDS.infinityEdge, ITEM_IDS.guardianAngel, ITEM_IDS.ldr];
  }
}

function getResponseCandidates(
  archetype: ChampionArchetype,
  damageFlavor: DamageFlavor,
  target: EnemyCounterTarget,
  enemyThreat: ReturnType<typeof summarizeEnemyThreats>
): number[] {
  if (target.archetype === "assassin") {
    return damageFlavor === "physical"
      ? (archetype === "marksman"
        ? [ITEM_IDS.guardianAngel, ITEM_IDS.maw, ITEM_IDS.phantomDancer]
        : [ITEM_IDS.deathsDance, ITEM_IDS.guardianAngel, ITEM_IDS.maw])
      : [ITEM_IDS.zhonyas, ITEM_IDS.bansheesVeil, ITEM_IDS.forceOfNature];
  }

  if (target.archetype === "mage" || target.archetype === "support") {
    return damageFlavor === "physical"
      ? [ITEM_IDS.maw, ITEM_IDS.mercurial, ITEM_IDS.guardianAngel]
      : [ITEM_IDS.bansheesVeil, ITEM_IDS.zhonyas, ITEM_IDS.forceOfNature];
  }

  if (target.archetype === "marksman") {
    return archetype === "marksman"
      ? [ITEM_IDS.ldr, ITEM_IDS.krakenSlayer, ITEM_IDS.mortalReminder]
      : [ITEM_IDS.blackCleaver, ITEM_IDS.deathsDance, ITEM_IDS.ldr];
  }

  const vsHealing = enemyThreat.healingPressure;
  const vsArmor = enemyThreat.armorPressure || target.archetype === "tank" || target.archetype === "fighter";
  const vsMagic = enemyThreat.mrPressure;

  if (vsHealing) {
    return damageFlavor === "magic"
      ? [ITEM_IDS.morellonomicon, ITEM_IDS.voidStaff, ITEM_IDS.zhonyas]
      : [ITEM_IDS.mortalReminder, ITEM_IDS.ldr, ITEM_IDS.thornmail];
  }

  if (vsArmor) {
    return archetype === "marksman"
      ? [ITEM_IDS.ldr, ITEM_IDS.krakenSlayer, ITEM_IDS.mortalReminder]
      : archetype === "mage"
        ? [ITEM_IDS.voidStaff, ITEM_IDS.morellonomicon, ITEM_IDS.zhonyas]
        : [ITEM_IDS.blackCleaver, ITEM_IDS.deathsDance, ITEM_IDS.ldr];
  }

  if (vsMagic) {
    return damageFlavor === "physical"
      ? [ITEM_IDS.maw, ITEM_IDS.mercurial, ITEM_IDS.bansheesVeil]
      : [ITEM_IDS.voidStaff, ITEM_IDS.bansheesVeil, ITEM_IDS.forceOfNature];
  }

  return archetype === "marksman"
    ? [ITEM_IDS.guardianAngel, ITEM_IDS.phantomDancer, ITEM_IDS.ldr]
    : archetype === "mage"
      ? [ITEM_IDS.bansheesVeil, ITEM_IDS.zhonyas, ITEM_IDS.voidStaff]
      : archetype === "tank"
        ? [ITEM_IDS.randuin, ITEM_IDS.forceOfNature, ITEM_IDS.gargoyleStoneplate]
      : [ITEM_IDS.deathsDance, ITEM_IDS.guardianAngel, ITEM_IDS.blackCleaver];
}

function selectEnemyCounterTarget(
  snapshot: GameSnapshot,
  championCatalog: Map<string, { name: string; tags?: string[] }>,
  strategicContext?: StrategicContext | null
): EnemyCounterTarget {
  const laneOpponent = snapshot.enemyPlayers.find((player) => player.position === snapshot.activePlayerPosition) ?? snapshot.enemyPlayers[0];
  const laneOpponentArchetype = classifyChampionArchetype(championCatalog, laneOpponent?.championName, laneOpponent?.position);

  const strongestThreat = strategicContext?.enemyThreats?.[0];
  if (strongestThreat?.championName) {
    const threatPlayer =
      snapshot.enemyPlayers.find((player) => player.championName === strongestThreat.championName) ??
      snapshot.enemyPlayers.find((player) => player.summonerName === strongestThreat.championName);
    const archetype = classifyChampionArchetype(
      championCatalog,
      strongestThreat.championName,
      threatPlayer?.position ?? strongestThreat.championName
    );

    return {
      championName: strongestThreat.championName,
      archetype,
      lane: threatPlayer?.position ?? "UNKNOWN",
      source: "threat"
    };
  }

  return {
    championName: laneOpponent?.championName ?? snapshot.enemyPlayers[0]?.championName ?? "o adversario",
    archetype: laneOpponentArchetype,
    lane: laneOpponent?.position ?? "UNKNOWN",
    source: "lane"
  };
}

function summarizeEnemyThreats(
  snapshot: GameSnapshot,
  championCatalog: Map<string, { name: string; tags?: string[] }>,
  itemCatalog: Map<string, { name: string; tags?: string[] }>,
  strategicContext?: StrategicContext | null
): {
  laneOpponent: SnapshotPlayer | undefined;
  laneOpponentArchetype: ChampionArchetype;
  teamMagicPressure: number;
  teamPhysicalPressure: number;
  teamFrontlinePressure: number;
  healingPressure: boolean;
  armorPressure: boolean;
  mrPressure: boolean;
  enemyItemNames: string[];
} {
  const laneOpponent = snapshot.enemyPlayers.find((player) => player.position === snapshot.activePlayerPosition) ?? snapshot.enemyPlayers[0];
  const laneOpponentArchetype = classifyChampionArchetype(championCatalog, laneOpponent?.championName, laneOpponent?.position);

  let teamMagicPressure = 0;
  let teamPhysicalPressure = 0;
  let teamFrontlinePressure = 0;
  let healingPressure = false;
  let armorPressure = false;
  let mrPressure = false;
  const enemyItemNames = new Set<string>();

  for (const enemy of snapshot.enemyPlayers) {
    const archetype = classifyChampionArchetype(championCatalog, enemy.championName, enemy.position);
    if (archetype === "mage" || archetype === "support") teamMagicPressure += 1;
    if (archetype === "marksman" || archetype === "fighter" || archetype === "assassin") teamPhysicalPressure += 1;
    if (archetype === "tank" || archetype === "support") teamFrontlinePressure += 1;
    if (HEALING_CHAMPIONS.has(enemy.championName)) healingPressure = true;
  }

  const enemyBuilds = strategicContext?.enemyBuilds ?? [];
  for (const enemyBuild of enemyBuilds) {
    for (const item of enemyBuild.majorItemDetails) {
      if (item?.name) {
        enemyItemNames.add(item.name);
      }
      const itemDef = itemCatalog.get(String(item?.id ?? ""));
      const tags = itemDef?.tags ?? [];
      const lower = String(item?.name ?? "").toLowerCase();
      if (isDefensiveItem(lower) || tags.includes("Armor") || tags.includes("SpellBlock") || tags.includes("Health")) {
        if (tags.includes("Armor") || lower.includes("armor") || lower.includes("heart") || lower.includes("randuin") || lower.includes("thornmail") || lower.includes("steelcaps") || lower.includes("gargoyle") || lower.includes("sunfire")) {
          armorPressure = true;
        }
        if (tags.includes("SpellBlock") || lower.includes("spellblock") || lower.includes("banshee") || lower.includes("visage") || lower.includes("force of nature") || lower.includes("maw")) {
          mrPressure = true;
        }
      }
      if (tags.includes("LifeSteal") || tags.includes("HealthRegen") || lower.includes("bloodthirster") || lower.includes("ravenous") || lower.includes("sustain")) {
        healingPressure = true;
      }
    }
  }

  if (teamPhysicalPressure >= 3) armorPressure = true;
  if (teamMagicPressure >= 3) mrPressure = true;

  return {
    laneOpponent,
    laneOpponentArchetype,
    teamMagicPressure,
    teamPhysicalPressure,
    teamFrontlinePressure,
    healingPressure,
    armorPressure,
    mrPressure,
    enemyItemNames: [...enemyItemNames]
  };
}

function chooseCoreItemId(
  archetype: ChampionArchetype,
  damageFlavor: DamageFlavor,
  phase: GamePhase,
  enemyThreat: ReturnType<typeof summarizeEnemyThreats>
): number | null {
  switch (archetype) {
    case "marksman":
      if (enemyThreat.healingPressure) return ITEM_IDS.mortalReminder;
      if (enemyThreat.teamFrontlinePressure >= 2 || enemyThreat.armorPressure) return phase === "early" ? ITEM_IDS.krakenSlayer : ITEM_IDS.ldr;
      if (phase === "early") return ITEM_IDS.berserkers;
      if (phase === "mid") return ITEM_IDS.infinityEdge;
      return ITEM_IDS.phantomDancer;
    case "mage":
      if (damageFlavor === "magic" && phase === "early") return ITEM_IDS.lichBane;
      if (phase === "early") return ITEM_IDS.nashors;
      if (phase === "mid") return ITEM_IDS.rabadons;
      return ITEM_IDS.voidStaff;
    case "assassin":
      if (damageFlavor === "magic") {
        if (phase === "early") return ITEM_IDS.lichBane;
        if (phase === "mid") return ITEM_IDS.zhonyas;
        return ITEM_IDS.voidStaff;
      }
      if (phase === "early") return ITEM_IDS.youmuusGhostblade;
      if (phase === "mid") return ITEM_IDS.deathsDance;
      return ITEM_IDS.guardianAngel;
    case "fighter":
      if (phase === "early") return ITEM_IDS.trinityForce;
      if (phase === "mid") return ITEM_IDS.blackCleaver;
      return ITEM_IDS.deathsDance;
    case "tank":
      if (phase === "early") return ITEM_IDS.sunfireAegis;
      if (phase === "mid") return ITEM_IDS.jakSho;
      return ITEM_IDS.gargoyleStoneplate;
    case "support":
      if (phase === "early") return ITEM_IDS.locket;
      if (phase === "mid") return ITEM_IDS.locket;
      return ITEM_IDS.gargoyleStoneplate;
    default:
      if (phase === "early") return ITEM_IDS.berserkers;
      if (phase === "mid") return ITEM_IDS.infinityEdge;
      return ITEM_IDS.guardianAngel;
  }
}

function chooseResponseItemId(
  archetype: ChampionArchetype,
  damageFlavor: DamageFlavor,
  enemyThreat: ReturnType<typeof summarizeEnemyThreats>,
  phase: GamePhase
): number | null {
  const opponentIsMagic = enemyThreat.laneOpponentArchetype === "mage" || enemyThreat.teamMagicPressure >= 2 || enemyThreat.mrPressure;
  const opponentIsPhysical =
    enemyThreat.laneOpponentArchetype === "marksman" ||
    enemyThreat.laneOpponentArchetype === "fighter" ||
    enemyThreat.laneOpponentArchetype === "assassin" ||
    enemyThreat.teamPhysicalPressure >= 2 ||
    enemyThreat.armorPressure;

  if (enemyThreat.healingPressure) {
    if (damageFlavor === "magic") return ITEM_IDS.morellonomicon;
    if (archetype === "tank") return ITEM_IDS.thornmail;
    return ITEM_IDS.mortalReminder;
  }

  if (enemyThreat.armorPressure) {
    if (archetype === "marksman") return ITEM_IDS.ldr;
    if (archetype === "fighter") return ITEM_IDS.blackCleaver;
    if (archetype === "assassin") return ITEM_IDS.blackCleaver;
    if (archetype === "mage") return ITEM_IDS.voidStaff;
  }

  if (enemyThreat.mrPressure) {
    if (damageFlavor === "magic") return ITEM_IDS.voidStaff;
    if (archetype === "marksman") return ITEM_IDS.maw;
    if (archetype === "fighter") return ITEM_IDS.maw;
  }

  if (opponentIsPhysical) {
    if (damageFlavor === "magic") return ITEM_IDS.zhonyas;
    if (archetype === "marksman") return phase === "late" ? ITEM_IDS.guardianAngel : ITEM_IDS.phantomDancer;
    if (archetype === "fighter") return ITEM_IDS.deathsDance;
    if (archetype === "tank") return ITEM_IDS.randuin;
    if (archetype === "support") return ITEM_IDS.locket;
    return ITEM_IDS.guardianAngel;
  }

  if (opponentIsMagic) {
    if (damageFlavor === "physical") {
      if (archetype === "marksman") return ITEM_IDS.maw;
      if (archetype === "fighter") return ITEM_IDS.maw;
      if (archetype === "assassin") return ITEM_IDS.maw;
      return ITEM_IDS.mercurial;
    }
    if (damageFlavor === "magic") return ITEM_IDS.bansheesVeil;
    if (archetype === "tank") return ITEM_IDS.forceOfNature;
    return ITEM_IDS.bansheesVeil;
  }

  if (archetype === "mage") return ITEM_IDS.bansheesVeil;
  if (archetype === "marksman") return ITEM_IDS.guardianAngel;
  if (archetype === "fighter") return ITEM_IDS.deathsDance;
  if (archetype === "tank") return ITEM_IDS.randuin;
  if (archetype === "support") return ITEM_IDS.locket;
  return phase === "early" ? ITEM_IDS.berserkers : ITEM_IDS.guardianAngel;
}

async function buildItemizationAdvice(
  snapshot: GameSnapshot,
  strategicContext?: StrategicContext | null
): Promise<ItemizationAdvice> {
  const [championCatalog, itemCatalog] = await Promise.all([getChampionCatalog(), getItemCatalog()]);
  const playerChampion = snapshot.activePlayerChampion || snapshot.activePlayerName || "seu campeao";
  const playerArchetype = classifyChampionArchetype(championCatalog, playerChampion, snapshot.activePlayerPosition);
  const enemyThreat = summarizeEnemyThreats(snapshot, championCatalog, itemCatalog, strategicContext);
  const damageFlavor = inferDamageFlavor(championCatalog, playerChampion, playerArchetype);
  const phase = getGamePhase(snapshot.gameTime);
  const ownedItemIds = collectOwnedItemIds(snapshot, strategicContext);
  const target = selectEnemyCounterTarget(snapshot, championCatalog, strategicContext);
  const coreItemId = pickFirstAvailable(ownedItemIds, getItemPriorityCandidates(playerArchetype, damageFlavor, phase, enemyThreat));
  const responseItemId = pickFirstAvailable(
    ownedItemIds,
    getResponseCandidates(playerArchetype, damageFlavor, target, enemyThreat).filter((itemId) => itemId !== coreItemId)
  );

  const signals = [
    target.source === "threat" ? `ameaca:${target.championName}` : `lane:${target.championName}`,
    enemyThreat.healingPressure ? "cura/cura-visivel" : null,
    enemyThreat.armorPressure ? "armadura visivel" : null,
    enemyThreat.mrPressure ? "resistencia magica visivel" : null,
    enemyThreat.teamFrontlinePressure >= 2 ? "frente pesada" : null
  ].filter(Boolean) as string[];

  return {
    playerChampion,
    enemyChampion: target.championName,
    enemySource: target.source,
    playerArchetype,
    enemyArchetype: target.archetype,
    damageFlavor,
    phase,
    coreItemId,
    responseItemId,
    signals
  };
}

function formatItemizationHint(advice: ItemizationAdvice, itemCatalog: Map<string, { name: string }>): string {
  const coreItem = getItemName(itemCatalog, advice.coreItemId);
  const responseItem = getItemName(itemCatalog, advice.responseItemId);
  const bits: string[] = [];

  if (coreItem) bits.push(`no teu ${advice.playerChampion}, ${coreItem} e a base`);
  if (responseItem) {
    const enemyLabel = advice.enemySource === "threat" ? `a maior ameaca ${advice.enemyChampion}` : advice.enemyChampion;
    bits.push(`contra ${enemyLabel}, ${responseItem} responde melhor`);
  }

  if (bits.length === 0) return "";
  return ` Itemizacao: ${bits.join(" e ")}.`;
}

function buildMatchupFallbackMessage(advice: ItemizationAdvice, itemCatalog: Map<string, { name: string }>): string {
  const coreItem = getItemName(itemCatalog, advice.coreItemId);
  const responseItem = getItemName(itemCatalog, advice.responseItemId);
  const pieces: string[] = [];

  if (advice.enemyChampion && responseItem) {
    const enemyLabel = advice.enemySource === "threat" ? `a maior ameaca ${advice.enemyChampion}` : advice.enemyChampion;
    pieces.push(`Contra ${enemyLabel}, ${responseItem} responde melhor.`);
  }

  if (advice.playerChampion && coreItem) {
    pieces.push(`No teu ${advice.playerChampion}, ${coreItem} e a base.`);
  }

  if (pieces.length === 0) {
    if (advice.playerChampion) {
      return `No teu ${advice.playerChampion}, joga pela itemizacao correta da matchup.`;
    }
    return "Joga pela itemizacao correta da matchup.";
  }

  return pieces.join(" ");
}

function genderPronoun(championName: string): string {
  return FEMALE_CHAMPIONS.has(championName) ? "dela" : "dele";
}

function toSentence(text: string): string {
  if (!text) return "";
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DANGLING_ENDINGS = /\s+(para|no|na|de|do|dos|das|em|o|a|os|as|e|ou|um|uma|com|por|ao|a|que|se|seu|sua|seus|suas|pelo|pela|nos|nas|num)$/i;

function isTruncated(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return t.length < 5 || DANGLING_ENDINGS.test(t);
}

function heuristicAlert(snapshot: GameSnapshot, triggers: string[]): string | null {
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

export function detectCategory(priority: string | null): string {
  if (!priority) return "generico";
  const normalized = priority.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (normalized === "lembrete de mapa") return "mapa";
  if (normalized === "ouro parado alto") return "ouroParado";
  if (normalized.startsWith("inimigo fed:")) return "inimigoFed";
  if (normalized.includes("acelerou a build")) return "inimigoBuild";
  if (normalized.includes("powerspike")) return "powerspike";
  if (normalized.startsWith("roubaram ") || normalized.startsWith("roubamos ")) return "objetivoRoubo";
  if (normalized.startsWith("alma do dragao aliada:") || normalized.startsWith("alma do dragao inimiga:")) return "dragonSoul";
  if (normalized.startsWith("torre ")) return "torre";
  if (normalized.startsWith("perdemos torre")) return "torrePerdida";
  if (normalized.startsWith("inimigo morreu:")) return "inimigoMorreu";
  if (normalized.includes("voce morreu") || normalized.startsWith("cuidado com ")) return "morteJogador";
  if (normalized.includes("vezes")) return "morteStreak";
  if (normalized.includes("dragao") || normalized.includes("barao") || normalized.includes("arauto")) return "objetivo";
  if (normalized.startsWith("item fechado:")) return "itemFechado";
  if (normalized.startsWith("inimigo item:")) return "inimigoItem";
  if (normalized.startsWith("level up chave:") || normalized === "ult disponivel" || normalized.startsWith("inimigo ult antes:")) return "levelUp";
  if (normalized === "perdemos inibidor" || normalized === "pegamos inibidor inimigo") return "inibidor";
  if (normalized === "vitoria" || normalized === "derrota") return "fimDeJogo";
  if (normalized.startsWith("gank oportunidade:")) return "jungleGank";
  if (normalized.startsWith("lane precisa de ajuda:")) return "junglePressao";
  if (normalized.startsWith("gank timing:")) return "jungleTiming";
  if (normalized === "ace inimigo" || normalized.startsWith("ace inimigo:") || normalized === "ace aliado") return "ace";
  if (normalized.startsWith("multikill inimigo:") || normalized.startsWith("multikill aliado:")) return "multikill";
  if (normalized === "inibidor inimigo voltou") return "inibidorRespawn";
  if (normalized === "cs alerta") return "csAlerta";
  if (normalized === "ward alerta") return "wardAlerta";
  if (normalized.startsWith("dragao tipo aliado:")) return "dragonTipo";
  if (normalized.startsWith("dragao tipo inimigo:")) return "dragonTipoInimigo";
  if (normalized === "first blood aliado" || normalized === "first blood inimigo") return "firstBlood";
  if (normalized.startsWith("lane ouro desvantagem:") || normalized.startsWith("lane ouro vantagem:")) return "laneOuro";

  return "generico";
}

export function getCategoryCooldown(priority: string | null): number {
  const category = detectCategory(priority);
  return CATEGORY_COOLDOWNS[category] ?? CATEGORY_COOLDOWNS.generico;
}

function isSimpleTrigger(priority: string | null): boolean {
  if (!priority) return false;
  if (priority.startsWith("inimigo item:")) return false;

  const category = detectCategory(priority);
  return category !== "generico" && category !== "inimigoItem";
}

function fallbackMessage(priority: string | null): string {
  if (!priority) return "";

  if (priority.includes("em 10 segundos")) {
    const name = priority.replace(" em 10 segundos", "").trim();
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    const verb = name === "vastilarvas" ? "estao" : "esta";
    return `${capitalized} ${verb} para nascer.`;
  }

  if (priority === "lembrete de mapa") {
    return pickModePhrase("mapa");
  }

  if (priority === "ouro parado alto") {
    return pickModePhrase("ouroParado");
  }

  if (priority.startsWith("inimigo fed:")) {
    const name = priority.split(":")[1]?.trim();
    if (!name) return "";
    const pronoun = genderPronoun(name);
    const template = pickModePhrase("inimigoFed");
    return template.replace(/\{name\}/g, name).replace(/\{pronoun\}/g, pronoun);
  }

  if (priority.includes("acelerou a build")) {
    const name = priority.split(" acelerou")[0]?.trim();
    if (name) {
      const pronoun = genderPronoun(name);
      const template = pickModePhrase("inimigoBuild");
      return template.replace(/\{name\}/g, name).replace(/\{pronoun\}/g, pronoun);
    }
  }

  if (priority.includes("powerspike")) {
    const match = priority.match(/(\d+ (?:itens|item))/);
    const count = match ? match[1] : "itens";
    return pickModePhrase("powerspike").replace("{count}", count);
  }

  if (priority.startsWith("inimigo morreu:")) {
    const name = priority.split(":")[1]?.trim();
    if (name) return pickModePhrase("inimigoMorreu").replace(/\{name\}/g, name);
  }

  if (priority.includes("voce morreu")) {
    const match = priority.match(/(\d+) vezes/);
    const count = match ? match[1] : "";
    return pickModePhrase("morteStreak").replace("{count}", count);
  }

  if (priority.startsWith("cuidado com ")) {
    const name = priority.replace("cuidado com ", "").split(",")[0].trim();
    return pickModePhrase("morteJogador").replace(/\{name\}/g, name);
  }

  if (priority === "ult disponivel") {
    return pickModePhrase("ultDisponivel");
  }

  if (priority.startsWith("inimigo ult antes:")) {
    const name = priority.split(":")[1]?.trim();
    if (name) return pickModePhrase("inimigoUltAntes").replace(/\{name\}/g, name);
  }

  if (priority.startsWith("level up chave:")) {
    const level = priority.split(":")[1]?.trim();
    return pickModePhrase("levelUpChave").replace("{level}", level);
  }

  if (priority.startsWith("item fechado:")) {
    const item = priority.split(":")[1]?.trim();
    return pickModePhrase("itemFechado").replace("{item}", item);
  }

  if (priority.startsWith("inimigo counter antiCura")) {
    return pickModePhrase("inimigoAntiCura");
  }

  if (priority.startsWith("inimigo counter armadura")) {
    return pickModePhrase("inimigoArmadura");
  }

  if (priority.startsWith("inimigo counter resistMagica")) {
    return pickModePhrase("inimigoResistMagica");
  }

  if (priority.startsWith("inimigo item:")) {
    const after = priority.slice("inimigo item:".length).trim();
    const sepIdx = after.indexOf(":");
    if (sepIdx > 0) {
      const name = after.slice(0, sepIdx).trim();
      const item = after.slice(sepIdx + 1).trim();
      return pickModePhrase("inimigoItemPerigoso").replace(/\{name\}/g, name).replace(/\{item\}/g, item);
    }
  }

  if (priority === "perdemos inibidor") {
    return pickModePhrase("inibidorPerdido");
  }

  if (priority === "pegamos inibidor inimigo") {
    return pickModePhrase("inibidorInimigo");
  }

  if (priority === "vitoria") {
    return pickModePhrase("vitoriaPartida");
  }

  if (priority === "derrota") {
    return pickModePhrase("derrotaPartida");
  }

  if (priority.startsWith("gank oportunidade:")) {
    const match = priority.match(/gank oportunidade: (\w+)/);
    const lane = match ? match[1] : "lane";
    return pickModePhrase("jungleGank").replace("{lane}", lane);
  }

  if (priority.startsWith("lane precisa de ajuda:")) {
    const lane = priority.replace("lane precisa de ajuda: ", "").trim();
    return pickModePhrase("junglePressao").replace("{lane}", lane);
  }

  if (priority.startsWith("gank timing:")) {
    const content = priority.replace("gank timing: ", "");
    const laneMatch = content.match(/(top|mid|bot|jungle)/i);
    const lane = laneMatch ? laneMatch[1].toLowerCase() : "lane";

    let phraseKey: string;
    if (content.includes("esta limpando a selva") || content.includes("aproveita para pressionar")) {
      phraseKey = "jungleTimingOfensivo";
    } else if (content.includes("segunda rotacao") && content.includes("pressionar")) {
      phraseKey = "jungleTimingOfensivo";
    } else if (content.includes("segunda rotacao")) {
      phraseKey = "jungleTimingSegundaRotacao";
    } else if (content.includes("morreu") && content.includes("aproveita")) {
      phraseKey = "jungleTimingMorteOfensivo";
    } else if (content.includes("morreu")) {
      phraseKey = "jungleTimingMorte";
    } else {
      phraseKey = "jungleTimingDefensivo";
    }

    return pickModePhrase(phraseKey).replace("{lane}", lane);
  }

  if (priority === "ace inimigo" || priority.startsWith("ace inimigo:")) {
    const obj = priority.includes(":") ? priority.split(":")[1]?.trim() : null;
    if (obj) {
      return `Ace! Vai pro ${obj} agora.`;
    }
    return pickModePhrase("aceInimigo");
  }

  if (priority === "ace aliado") {
    return pickModePhrase("aceAliado");
  }

  if (priority.startsWith("multikill inimigo:")) {
    const parts = priority.slice("multikill inimigo:".length).trim().split(":");
    const name = parts[0]?.trim() ?? "";
    const type = parts[1]?.trim() ?? "multi kill";
    return pickModePhrase("multikillInimigo").replace(/\{name\}/g, name).replace(/\{type\}/g, type);
  }

  if (priority.startsWith("multikill aliado:")) {
    const parts = priority.slice("multikill aliado:".length).trim().split(":");
    const name = parts[0]?.trim() ?? "";
    const type = parts[1]?.trim() ?? "multi kill";
    return pickModePhrase("multikillAliado").replace(/\{name\}/g, name).replace(/\{type\}/g, type);
  }

  if (priority.startsWith("roubaram ")) {
    const name = priority.replace("roubaram ", "");
    return pickModePhrase("objetivoRoubado").replace(/\{name\}/g, name);
  }

  if (priority.startsWith("roubamos ")) {
    const name = priority.replace("roubamos ", "");
    return pickModePhrase("objetivoRoubadoPorNos").replace(/\{name\}/g, name);
  }

  if (priority === "first blood aliado") {
    return pickModePhrase("firstBlood");
  }

  if (priority === "first blood inimigo") {
    return pickModePhrase("firstBloodInimigo");
  }

  if (priority === "inibidor inimigo voltou") {
    return pickModePhrase("inibidorVoltou");
  }

  if (priority.startsWith("alma do dragao aliada:")) {
    const count = priority.split(":")[1]?.trim()?.replace("falta ", "") ?? "1";
    return pickModePhrase("dragonSoulProximo").replace(/\{count\}/g, count);
  }

  if (priority.startsWith("alma do dragao inimiga:")) {
    const count = priority.split(":")[1]?.trim()?.replace("falta ", "") ?? "1";
    return pickModePhrase("dragonSoulInimigoProximo").replace(/\{count\}/g, count);
  }

  if (priority === "cs alerta") {
    return pickModePhrase("csAlerta");
  }

  if (priority === "ward alerta") {
    return pickModePhrase("wardAlerta");
  }

  if (priority.startsWith("dragao tipo aliado:") || priority.startsWith("dragao tipo inimigo:")) {
    const isAlly = priority.startsWith("dragao tipo aliado:");
    const type = priority.split(":")[1]?.trim() ?? "";
    const typeNames: Record<string, string> = {
      Fire: "fogo", Earth: "terra", Water: "agua",
      Air: "vento", Hextech: "hextec", Chemtech: "quimico", Elder: "anciao",
    };
    const allyHints: Record<string, string> = {
      Fire: "Bom pro dano do time.",
      Earth: "Aumenta resistencia do time.",
      Water: "Regeneracao extra pro time.",
      Air: "Velocidade pro time.",
      Hextech: "Aceleracao de habilidade pro time.",
      Chemtech: "Dano e cura em luta.",
    };
    const enemyHints: Record<string, string> = {
      Fire: "Inimigo com mais dano agora.",
      Earth: "Inimigo mais resistente agora.",
      Water: "Inimigo com regeneracao extra.",
      Air: "Inimigo mais rapido agora.",
      Hextech: "Inimigo com mais aceleracao de habilidade.",
      Chemtech: "Inimigo com dano e cura extra em luta.",
    };
    const translated = typeNames[type] ?? type;
    const hint = isAlly ? (allyHints[type] ?? "") : (enemyHints[type] ?? "");
    const phraseKey = isAlly ? "dragonTipo" : "dragonTipoInimigo";
    return pickModePhrase(phraseKey).replace(/\{type\}/g, translated).replace(/\{hint\}/g, hint);
  }

  if (priority.startsWith("lane ouro desvantagem:")) {
    const parts = priority.slice("lane ouro desvantagem:".length).trim().split(":");
    const opponent = parts[0]?.trim() ?? "";
    const gold = parts[1]?.trim() ?? "";
    return pickModePhrase("laneVantagemOuro").replace(/\{opponent\}/g, opponent).replace(/\{gold\}/g, gold);
  }

  if (priority.startsWith("lane ouro vantagem:")) {
    const parts = priority.slice("lane ouro vantagem:".length).trim().split(":");
    const opponent = parts[0]?.trim() ?? "";
    const gold = parts[1]?.trim() ?? "";
    return pickModePhrase("laneDesvantagemOuro").replace(/\{opponent\}/g, opponent).replace(/\{gold\}/g, gold);
  }

  const sentence = toSentence(priority);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

function compactPlayer(player: SnapshotPlayer): string {
  return `${player.championName}(${player.kills}/${player.deaths}/${player.assists},nv${player.level})`;
}

function buildPrompt(
  snapshot: GameSnapshot,
  triggers: string[],
  priority: string | null,
  strategicContext: StrategicContext,
  itemContext = ""
): string {
  const alliedPlayers = Array.isArray(snapshot.alliedPlayers) ? snapshot.alliedPlayers : [];
  const enemyPlayers = Array.isArray(snapshot.enemyPlayers) ? snapshot.enemyPlayers : [];
  const allies = alliedPlayers.map(compactPlayer).join(", ");
  const enemies = enemyPlayers.map(compactPlayer).join(", ");

  const position = snapshot.activePlayerPosition ?? "UNKNOWN";
  const gameTime = typeof snapshot.gameTime === "number" ? snapshot.gameTime : 0;
  const lines = [
    `${Math.floor(gameTime / 60)}min | ${snapshot.activePlayerChampion ?? "desconhecido"} nv${snapshot.activePlayerLevel ?? "?"} ${snapshot.activePlayerKda ?? "?"} | ouro:${snapshot.activePlayerGold ?? 0} | posicao: ${position}`,
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
    lines.push(`Ameaca: ${t.championName} ${t.kda} [${t.build.join(",")}]`);
  }

  if (itemContext) {
    lines.push(itemContext);
  }

  if (strategicContext?.objectiveStates?.length > 0) {
    const objs = strategicContext.objectiveStates.map((o) =>
      o.available ? `${o.name}: disponivel` : `${o.name}: morto (nasce em ${o.spawnIn})`
    );
    lines.push(`Objetivos: ${objs.join(" | ")}`);
  }

  return lines.join("\n");
}

function buildPromptWithItemization(
  snapshot: GameSnapshot,
  triggers: string[],
  priority: string | null,
  strategicContext: StrategicContext,
  itemContext = ""
): string {
  return buildPrompt(snapshot, triggers, priority, strategicContext, itemContext);
}

function buildMatchupFallbackText(snapshot: GameSnapshot): string {
  const myChamp = snapshot.activePlayerChampion || "seu campeao";
  const myPos = snapshot.activePlayerPosition ?? "UNKNOWN";
  const laneOpponent = snapshot.enemyPlayers.find((p) => p.position === myPos);
  const enemyList = snapshot.enemyPlayers.map((p) => p.championName).filter(Boolean).join(", ");

  if (laneOpponent?.championName) {
    return `Voce e ${myChamp} na lane ${myPos} contra ${laneOpponent.championName}. Jogue pela matchup e deixe a LLM orientar a itemizacao quando houver contexto suficiente.`;
  }

  if (enemyList) {
    return `Voce e ${myChamp} na posicao ${myPos}. Inimigos visiveis: ${enemyList}. Jogue pela matchup e deixe a LLM orientar a itemizacao quando houver contexto suficiente.`;
  }

  return `Voce e ${myChamp} na posicao ${myPos}. Jogue pela matchup e deixe a LLM orientar a itemizacao quando houver contexto suficiente.`;
}

export async function decideCoaching(
  snapshot: GameSnapshot,
  triggers: string[],
  strategicContext: StrategicContext
): Promise<CoachDecision> {
  const priority = heuristicAlert(snapshot, triggers);
  const itemContext = buildItemContextBlock(snapshot, strategicContext);
  const fallback = fallbackMessage(priority);

  if (isSimpleTrigger(priority)) {
    return {
      shouldSpeak: !!fallback,
      message: fallback,
      reason: `heuristica direta: ${priority}`,
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
      reason: "sem contexto estrategico para LLM",
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

  const prompt = buildPromptWithItemization(snapshot, triggers, priority, strategicContext, itemContext);

  if (!hasLlmConfig()) {
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
    const isGlm = settings.zaiModel.includes("glm");
    const result = await runLlmTextRequest({
      apiKey: settings.zaiApiKey,
      endpoint: settings.zaiEndpoint,
      model: settings.zaiModel,
      label: "coach",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      maxOutputTokens: 500,
      ...(isGlm ? { chatRequest: { thinking: { type: "disabled" } } } : {})
    });
    llmMs = Math.round(performance.now() - llmStart);
    message = result.text;
    llmTokens = result.usage;
  } catch (error) {
    const err = error as Error;
    llmMs = Math.round(performance.now() - llmStart);
    llmError = err.message;
    console.error(`[Coach] LLM erro (${llmMs}ms):`, err.message);
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

export async function getMatchupTip(snapshot: GameSnapshot): Promise<MatchupTip | null> {
  if (!hasLlmConfig()) {
    return null;
  }

  const myChamp = snapshot.activePlayerChampion || "seu campeao";
  const myPos = snapshot.activePlayerPosition ?? "UNKNOWN";
  const laneOpponent = snapshot.enemyPlayers.find((p) => p.position === myPos);
  const otherEnemies = snapshot.enemyPlayers.filter((p) => p.position !== myPos).map((p) => p.championName).join(", ");
  const itemContext = buildItemContextBlock(snapshot, null);

  const prompt = [
    laneOpponent
      ? `Voce e ${myChamp} na lane ${myPos}. Seu adversario direto e ${laneOpponent.championName}. Outros inimigos: ${otherEnemies || "nenhum visivel"}. De a dica de matchup.`
      : `Voce e ${myChamp} na posicao ${myPos}. Inimigos: ${snapshot.enemyPlayers.map((p) => p.championName).join(", ") || "nenhum visivel"}. De a dica de matchup.`,
    itemContext
  ].filter(Boolean).join("\n");

  let message = "";
  let llmMs = 0;
  let llmTokens: unknown = null;
  const llmStart = performance.now();
  try {
    const isGlm = settings.zaiModel.includes("glm");
    const result = await runLlmTextRequest({
      apiKey: settings.zaiApiKey,
      endpoint: settings.zaiEndpoint,
      model: settings.zaiModel,
      label: "matchup",
      messages: [
        { role: "system", content: buildMatchupPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      maxOutputTokens: 500,
      ...(isGlm ? { chatRequest: { thinking: { type: "disabled" } } } : {})
    });
    llmMs = Math.round(performance.now() - llmStart);
    message = result.text;
    llmTokens = result.usage;
  } catch (error) {
    const err = error as Error;
    llmMs = Math.round(performance.now() - llmStart);
    console.error(`[Coach] Matchup LLM erro (${llmMs}ms):`, err.message);
  }

  if (!message || isTruncated(message)) {
    return null;
  }

  return { message, llmMs, llmTokens };
}

export async function getMatchupTipWithFallback(snapshot: GameSnapshot): Promise<MatchupTip> {
  const myChamp = snapshot.activePlayerChampion || "seu campeao";
  const myPos = snapshot.activePlayerPosition ?? "UNKNOWN";
  const laneOpponent = snapshot.enemyPlayers.find((p) => p.position === myPos);
  const otherEnemies = snapshot.enemyPlayers.filter((p) => p.position !== myPos).map((p) => p.championName).join(", ");
  const itemContext = buildItemContextBlock(snapshot, null);

  const prompt = [
    laneOpponent
      ? `Voce e ${myChamp} na lane ${myPos}. Seu adversario direto e ${laneOpponent.championName}. Outros inimigos: ${otherEnemies || "nenhum visivel"}. De a dica de matchup.`
      : `Voce e ${myChamp} na posicao ${myPos}. Inimigos: ${snapshot.enemyPlayers.map((p) => p.championName).join(", ") || "nenhum visivel"}. De a dica de matchup.`,
    itemContext
  ].filter(Boolean).join("\n");

  if (!hasLlmConfig()) {
    return {
      message: buildMatchupFallbackText(snapshot),
      llmMs: 0,
      llmTokens: null
    };
  }

  let message = "";
  let llmMs = 0;
  let llmTokens: unknown = null;
  const llmStart = performance.now();
  try {
    const isGlm = settings.zaiModel.includes("glm");
    const result = await runLlmTextRequest({
      apiKey: settings.zaiApiKey,
      endpoint: settings.zaiEndpoint,
      model: settings.zaiModel,
      label: "matchup",
      messages: [
        { role: "system", content: buildMatchupPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      maxOutputTokens: 500,
      ...(isGlm ? { chatRequest: { thinking: { type: "disabled" } } } : {})
    });
    llmMs = Math.round(performance.now() - llmStart);
    message = result.text;
    llmTokens = result.usage;
  } catch (error) {
    const err = error as Error;
    llmMs = Math.round(performance.now() - llmStart);
    console.error(`[Coach] Matchup LLM erro (${llmMs}ms):`, err.message);
  }

  if (!message || isTruncated(message)) {
    return {
      message: buildMatchupFallbackText(snapshot),
      llmMs,
      llmTokens
    };
  }

  return { message, llmMs, llmTokens };
}

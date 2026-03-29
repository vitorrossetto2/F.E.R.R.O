import { settings } from "./config";
import { ITEM_TAGS, pickModePhrase } from "./constants";
import { getItemCatalog } from "./ddragon";
import type { AnalyzeSnapshotResult, GameEvent, GameSnapshot, LoopStateShape, SnapshotPlayer, StrategicContext } from "./types";

const RESPAWN_BY_LEVEL = [
  10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5
];

function getObjectiveThresholds(): Array<{ label: string; threshold: number; render: (name: string) => string }> {
  return [
    {
      label: "60",
      threshold: settings.objectiveOneMinuteCallSeconds,
      render: (name) => `${name} em 1 minuto`
    },
    {
      label: "30",
      threshold: settings.objectiveThirtySecondsCallSeconds,
      render: (name) => `${name} em 30 segundos`
    },
    {
      label: "10",
      threshold: settings.objectiveTenSecondsCallSeconds,
      render: (name) => `${name} em 10 segundos`
    },
    {
      label: "spawn",
      threshold: 0,
      render: (name) => `${name} nasceu agora`
    }
  ];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function triggerUrgencyScore(trigger: string): number {
  if (trigger.includes("nasceu agora")) return 0;
  if (trigger.includes("em 10 segundos")) return 1;
  if (trigger.includes("em 30 segundos")) return 2;
  if (trigger.includes("em 1 minuto")) return 3;
  if (trigger.startsWith("inimigo morreu:")) return 4;
  if (trigger.includes("powerspike")) return 5;
  if (trigger.includes("acelerou a build")) return 6;
  if (trigger.includes("torre")) return 7;
  if (trigger.includes("ace")) return 0;
  if (trigger.includes("roubaram") || trigger.includes("roubamos")) return 1;
  if (trigger.includes("multikill")) return 2;
  if (trigger.includes("first blood")) return 3;
  if (trigger.includes("alma do dragão")) return 4;
  if (trigger.includes("inibidor inimigo voltou")) return 6;
  if (trigger === "cs alerta" || trigger === "ward alerta") return 10;
  if (trigger.startsWith("dragão tipo ")) return 6;
  if (trigger === "lembrete de mapa") return 10;
  if (trigger.startsWith("lane ouro")) return 9;
  return 8;
}

export function sortTriggersByUrgency(triggers: string[]): string[] {
  return [...triggers].sort((a, b) => triggerUrgencyScore(a) - triggerUrgencyScore(b));
}

function getEventsByName(snapshot: GameSnapshot, names: string[]): GameEvent[] {
  return snapshot.events.filter((event) => typeof event.EventName === "string" && names.includes(event.EventName));
}

function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;

  if (minutes === 0) {
    return `${remainingSeconds} segundos`;
  }

  if (remainingSeconds === 0) {
    return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  }

  const minLabel = minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  return `${minLabel} e ${remainingSeconds} segundos`;
}

function getTimeIncreaseFactor(gameTimeSeconds: number): number {
  const gameMinutes = gameTimeSeconds / 60;

  if (gameMinutes < 15) return 0;
  if (gameMinutes < 30) {
    return Math.ceil(2 * (gameMinutes - 15)) * 0.00425;
  }
  if (gameMinutes < 45) {
    return 0.1275 + Math.ceil(2 * (gameMinutes - 30)) * 0.003;
  }

  return Math.min(0.5, 0.2175 + Math.ceil(2 * (gameMinutes - 45)) * 0.0145);
}

function estimateRespawnSeconds(level: number, gameTimeSeconds: number): number {
  const base = RESPAWN_BY_LEVEL[Math.max(0, Math.min(17, Number(level || 1) - 1))];
  const total = base + (base * getTimeIncreaseFactor(gameTimeSeconds));
  return Math.ceil(total);
}

function getPlayerLookup(snapshot: GameSnapshot): Map<string, SnapshotPlayer> {
  const players = [...snapshot.alliedPlayers, ...snapshot.enemyPlayers];
  const lookup = new Map<string, SnapshotPlayer>();

  for (const player of players) {
    lookup.set(player.summonerName, player);
    lookup.set(player.championName, player);
  }

  return lookup;
}

function getDragonTimer(snapshot: GameSnapshot): number {
  const dragonKills = getEventsByName(snapshot, ["DragonKill"]);
  if (dragonKills.length === 0) {
    return settings.dragonFirstSpawnSeconds;
  }

  const lastKill = dragonKills[dragonKills.length - 1];
  return Number(lastKill.EventTime ?? 0) + settings.dragonRespawnSeconds;
}

function getBaronTimer(snapshot: GameSnapshot): number {
  const baronKills = getEventsByName(snapshot, ["BaronKill"]);
  if (baronKills.length === 0) {
    return settings.baronFirstSpawnSeconds;
  }

  const lastKill = baronKills[baronKills.length - 1];
  return Number(lastKill.EventTime ?? 0) + settings.baronRespawnSeconds;
}

function getGrubsTimer(snapshot: GameSnapshot): number | null {
  if (snapshot.gameTime >= settings.grubsDespawnSeconds) {
    return null;
  }

  const grubKills = getEventsByName(snapshot, ["HordeKill", "VoidGrubKill"]);
  if (grubKills.length === 0) {
    return settings.grubsFirstSpawnSeconds;
  }

  // All grubs cleared (6 = 2 waves of 3)
  if (grubKills.length >= 6) {
    return null;
  }

  // After first wave, estimate next wave respawn
  const lastKill = grubKills[grubKills.length - 1];
  const respawnAt = Number(lastKill.EventTime ?? 0) + 120;

  if (respawnAt >= settings.grubsDespawnSeconds) {
    return null;
  }

  return respawnAt;
}

function getHeraldTimer(snapshot: GameSnapshot): number | null {
  if (snapshot.gameTime < settings.heraldFirstSpawnSeconds) {
    return settings.heraldFirstSpawnSeconds;
  }

  if (snapshot.gameTime >= settings.baronFirstSpawnSeconds) {
    return null;
  }

  const heraldKills = getEventsByName(snapshot, ["HeraldKill", "RiftHeraldKill"]);
  if (heraldKills.length === 0) {
    return settings.heraldFirstSpawnSeconds;
  }

  if (heraldKills.length >= 2) {
    return null;
  }

  return null;
}

function getObjectiveStates(snapshot: GameSnapshot): Array<{ name: string; spawnAt: number }> {
  return [
    { name: "dragão", spawnAt: getDragonTimer(snapshot) },
    { name: "vastilarvas", spawnAt: getGrubsTimer(snapshot) },
    { name: "arauto", spawnAt: getHeraldTimer(snapshot) },
    { name: "barão", spawnAt: getBaronTimer(snapshot) }
  ].filter((objective): objective is { name: string; spawnAt: number } => objective.spawnAt !== null);
}

function collectObjectiveTriggers(snapshot: GameSnapshot, state: LoopStateShape): string[] {
  const triggers: string[] = [];
  const previousGameTime = state.lastAnalyzedGameTime ?? null;

  for (const objective of getObjectiveStates(snapshot)) {
    const timeUntil = objective.spawnAt - snapshot.gameTime;
    const previousTimeUntil =
      previousGameTime === null ? null : objective.spawnAt - previousGameTime;

    const roundedSpawnAt = Math.round(objective.spawnAt);
    for (const window of getObjectiveThresholds()) {
      const key = `${objective.name}:${roundedSpawnAt}:${window.label}`;

      const crossedThreshold =
        previousTimeUntil !== null &&
        previousTimeUntil > window.threshold &&
        timeUntil <= window.threshold;

      const firstSeenInsideThreshold =
        previousTimeUntil === null &&
        timeUntil <= window.threshold &&
        timeUntil >= window.threshold - (settings.pollIntervalSeconds * 2);

      if ((crossedThreshold || firstSeenInsideThreshold) && !state.announcedKeys.has(key)) {
        // Skip "nasceu agora" if "em 10 segundos" was already announced (redundant)
        if (window.label === "spawn") {
          const tenKey = `${objective.name}:${objective.spawnAt}:10`;
          if (state.announcedKeys.has(tenKey)) {
            state.announcedKeys.add(key);
            continue;
          }
        }
        state.announcedKeys.add(key);
        triggers.push(window.render(objective.name));
      }
    }
  }

  return triggers;
}

function detectLane(turretName: string): string {
  const normalized = (turretName ?? "").toUpperCase();
  // Riot format: Turret_TOrder_L1_P3 where L0=bot, L1=mid, L2=top
  if (normalized.includes("_L1_") || normalized.includes("_MID_") || normalized.endsWith("_MID")) return "mid";
  if (normalized.includes("_L2_") || normalized.includes("_TOP_") || normalized.includes("_C_TOP") || normalized.endsWith("_TOP")) return "top";
  if (normalized.includes("_L0_") || normalized.includes("_BOT_") || normalized.includes("_C_BOT") || normalized.endsWith("_BOT")) return "bot";
  return "side";
}

function detectTier(turretName: string): string {
  const normalized = (turretName ?? "").toUpperCase();
  if (normalized.includes("_C_") || normalized.includes("NEXUS")) return "nexus";
  if (normalized.includes("_P3")) return "T1";
  if (normalized.includes("_P2")) return "T2";
  if (normalized.includes("_P1")) return "T3";
  return "";
}

function isAllyTurret(turretName: string, playerTeam: string): boolean {
  const normalized = (turretName ?? "").toUpperCase();
  const turretTeam = normalized.includes("TORDER") ? "ORDER" : "CHAOS";
  return turretTeam === (playerTeam ?? "ORDER").toUpperCase();
}

function turretRotationHint(lane: string, snapshot: GameSnapshot, allied: boolean): string {
  if (allied) {
    if (lane === "mid") return pickModePhrase("torrePerdidaMid");
    if (lane === "top") return pickModePhrase("torrePerdidaTop");
    if (lane === "bot") return pickModePhrase("torrePerdidaBot");
    return pickModePhrase("torrePerdidaGenerica").replace("{lane}", lane);
  }

  const nextDragonAt = getDragonTimer(snapshot);
  const nextBaronAt = getBaronTimer(snapshot);
  const dragonSoon = nextDragonAt !== null && nextDragonAt - snapshot.gameTime <= 90;
  const baronSoon = nextBaronAt !== null && nextBaronAt - snapshot.gameTime <= 90;

  if (lane === "mid") return pickModePhrase("torreMid");
  if (lane === "top" && dragonSoon) return pickModePhrase("torreTopDragao");
  if (lane === "bot" && baronSoon) return pickModePhrase("torreBotBarao");

  return pickModePhrase("torreGenerica").replace("{lane}", lane);
}

function isMajorItem(definition: any): boolean {
  if (!definition) return false;

  const tags = definition.tags ?? [];
  if (tags.includes("Consumable") || tags.includes("Trinket")) {
    return false;
  }

  if (tags.includes("Boots")) {
    return false;
  }

  const totalGold = Number(definition.gold?.total ?? 0);
  const upgradesInto = Array.isArray(definition.into) ? definition.into : [];
  return upgradesInto.length === 0 && totalGold >= 2200;
}

function summarizeBuild(player: SnapshotPlayer, itemCatalog: Map<string, any>) {
  const enrichedItems = player.items
    .map((item) => ({
      ...item,
      definition: itemCatalog.get(String(item.id))
    }))
    .filter((item) => item.name);

  const meaningfulItems = enrichedItems.filter((item) => {
    const tags = item.definition?.tags ?? [];
    return !tags.includes("Consumable") && !tags.includes("Trinket");
  });
  const majorItems = meaningfulItems.filter((item) => isMajorItem(item.definition));

  return {
    itemNames: meaningfulItems.map((item) => item.name),
    majorItemCount: majorItems.length,
    keyItems: majorItems.slice(0, 3).map((item) => item.name),
    majorItemIds: new Set(majorItems.map((item) => item.id)),
    majorItemDetails: majorItems.map((item) => ({ id: item.id, name: item.name }))
  };
}

function combatScore(player: SnapshotPlayer, build: { majorItemCount: number }): number {
  return (
    (player.kills * 3) +
    (player.assists * 1.5) -
    (player.deaths * 2) +
    player.level +
    (build.majorItemCount * 4)
  );
}

async function buildStrategicContext(snapshot: GameSnapshot): Promise<StrategicContext> {
  const itemCatalog = await getItemCatalog();
  const alliedBuilds = snapshot.alliedPlayers.map((player) => ({
    player,
    build: summarizeBuild(player, itemCatalog)
  }));
  const enemyBuilds = snapshot.enemyPlayers.map((player) => ({
    player,
    build: summarizeBuild(player, itemCatalog)
  }));
  const activePlayerEntry =
    alliedBuilds.find((entry) => entry.player.summonerName === snapshot.activePlayerName) ??
    alliedBuilds[0];
  const sortedEnemies = [...enemyBuilds].sort(
    (a, b) => combatScore(b.player, b.build) - combatScore(a.player, a.build)
  );
  const enemyThreat = sortedEnemies[0];
  const topThreats = sortedEnemies
    .filter((entry) => entry.player.kills >= 3 || combatScore(entry.player, entry.build) >= 15)
    .slice(0, 3);

  const alliedPower =
    alliedBuilds.reduce((sum, entry) => sum + combatScore(entry.player, entry.build), 0);
  const enemyPower =
    enemyBuilds.reduce((sum, entry) => sum + combatScore(entry.player, entry.build), 0);

  let scalingRead = "escalonamento equilibrado";
  if (alliedPower - enemyPower >= 12) {
    scalingRead = "seu time está mais forte agora";
  } else if (enemyPower - alliedPower >= 12) {
    scalingRead = "time inimigo está mais forte agora";
  }

  return {
    activePlayer: {
      championName: activePlayerEntry?.player.championName ?? snapshot.activePlayerChampion,
      build: activePlayerEntry?.build.itemNames ?? [],
      majorItemCount: activePlayerEntry?.build.majorItemCount ?? 0,
      majorItemIds: activePlayerEntry?.build.majorItemIds ?? new Set(),
      majorItemDetails: activePlayerEntry?.build.majorItemDetails ?? []
    },
    enemyBuilds: enemyBuilds.map((entry) => ({
      championName: entry.player.championName,
      majorItemIds: entry.build.majorItemIds,
      majorItemDetails: entry.build.majorItemDetails,
      itemNames: entry.build.itemNames
    })),
    enemyThreat: enemyThreat
      ? {
          championName: enemyThreat.player.championName,
          score: combatScore(enemyThreat.player, enemyThreat.build),
          kda: `${enemyThreat.player.kills}/${enemyThreat.player.deaths}/${enemyThreat.player.assists}`,
          build: enemyThreat.build.keyItems,
          majorItemCount: enemyThreat.build.majorItemCount
        }
      : null,
    enemyThreats: topThreats.map((entry) => ({
      championName: entry.player.championName,
      score: combatScore(entry.player, entry.build),
      kda: `${entry.player.kills}/${entry.player.deaths}/${entry.player.assists}`,
      build: entry.build.keyItems,
      majorItemCount: entry.build.majorItemCount
    })),
    alliedPower,
    enemyPower,
    scalingRead,
    objectiveStates: getObjectiveStates(snapshot).map((objective) => ({
      name: objective.name,
      spawnIn: formatDuration(objective.spawnAt - snapshot.gameTime),
      available: objective.spawnAt <= snapshot.gameTime
    }))
  };
}

function getBestAvailableObjective(snapshot: GameSnapshot): string | null {
  const gt = snapshot.gameTime;

  // Check baron availability (spawns at 1200s, respawns every 360s)
  const baronKills = getEventsByName(snapshot, ["BaronKill"]);
  const baronAvailable = gt >= 1200 && (
    baronKills.length === 0 ||
    gt - Number(baronKills[baronKills.length - 1].EventTime ?? 0) >= 360
  );

  // Check dragon availability (first spawn 300s, respawns every 300s)
  const dragonKills = getEventsByName(snapshot, ["DragonKill"]);
  const dragonAvailable = dragonKills.length === 0
    ? gt >= 300
    : gt - Number(dragonKills[dragonKills.length - 1].EventTime ?? 0) >= 300;

  // Baron is higher priority if available
  if (baronAvailable) return "barão";
  if (dragonAvailable) return "dragão";
  return null;
}

function collectEventTriggers(
  snapshot: GameSnapshot,
  state: LoopStateShape,
  newEvents: GameEvent[],
  playerLookup: Map<string, SnapshotPlayer>
): string[] {
  const triggers: string[] = [];

  for (const event of newEvents) {
    const eventId = event?.EventID;
    if (typeof eventId === "number" && state.processedEventIds.has(eventId)) continue;
    if (typeof eventId === "number") state.processedEventIds.add(eventId);

    const eventName = event?.EventName;

    if (eventName === "ChampionKill") {
      const victim = typeof event.VictimName === "string" ? playerLookup.get(event.VictimName) : undefined;
      if (victim && snapshot.enemyPlayers.some((player) => player.summonerName === victim.summonerName)) {
        const respawnSeconds = estimateRespawnSeconds(victim.level, snapshot.gameTime);
        if (respawnSeconds >= 8) {
          triggers.push(`inimigo morreu: ${victim.championName}`);
        }
      }

      if (event?.VictimName === snapshot.activePlayerName) {
        state.playerDeathCount = (state.playerDeathCount ?? 0) + 1;
        const killerPlayer = typeof event.KillerName === "string" ? playerLookup.get(event.KillerName) : undefined;
        const killerChamp = killerPlayer?.championName ?? event?.KillerName ?? "inimigo";
        if (state.playerDeathCount >= 3 && state.playerDeathCount % 2 === 1) {
          triggers.push(`você morreu ${state.playerDeathCount} vezes, joga mais seguro e perto do time`);
        } else {
          triggers.push(`cuidado com ${killerChamp}, evita ficar sozinho contra`);
        }
      }
    }

    if (eventName === "TurretKilled") {
      const turretName = event?.TurretKilled ?? "";
      const lane = detectLane(turretName);
      const tier = detectTier(turretName);
      const allied = isAllyTurret(turretName, snapshot.activePlayerTeam);
      const hint = turretRotationHint(lane, snapshot, allied);
      const tierLabel = tier ? `[${tier}] ` : "";
      triggers.push(`${tierLabel}${hint}`);
      if (allied && snapshot.activePlayerPosition === "JUNGLE" && lane !== "unknown") {
        triggers.push(`lane precisa de ajuda: ${lane}`);
      }
    }

    if (eventName === "InhibKilled") {
      const inhibName = event?.InhibKilled ?? "";
      const allied = isAllyTurret(inhibName, snapshot.activePlayerTeam);
      if (allied) {
        triggers.push("perdemos inibidor");
      } else {
        triggers.push("pegamos inibidor inimigo");
      }
    }

    if (eventName === "GameEnd") {
      const result = event?.Result;
      if (result === "Win") {
        triggers.push("vitória");
      } else {
        triggers.push("derrota");
      }
    }

    if (eventName === "Ace") {
      const acingTeam = event?.AcingTeam as string | undefined;
      const isEnemyAced = acingTeam === snapshot.activePlayerTeam;
      if (isEnemyAced) {
        const bestObj = getBestAvailableObjective(snapshot);
        if (bestObj) {
          triggers.push(`ace inimigo: ${bestObj}`);
        } else {
          triggers.push("ace inimigo");
        }
      } else {
        triggers.push("ace aliado");
      }
    }

    if (eventName === "DragonKill") {
      const dragonType = event?.DragonType as string | undefined;
      if (dragonType && dragonType !== "Elder") {
        const killerName = typeof event.KillerName === "string" ? event.KillerName : "";
        const killerPlayer = playerLookup.get(killerName);
        const isAlly = killerPlayer && snapshot.alliedPlayers.some((p) => p.summonerName === killerPlayer.summonerName);
        if (isAlly) {
          triggers.push(`dragão tipo aliado: ${dragonType}`);
        } else {
          triggers.push(`dragão tipo inimigo: ${dragonType}`);
        }
      }
    }

    if (eventName === "DragonKill" || eventName === "BaronKill") {
      const stolen = event?.Stolen === "True" || event?.Stolen === true;
      if (stolen) {
        const killerName = typeof event.KillerName === "string" ? event.KillerName : "";
        const killerPlayer = playerLookup.get(killerName);
        const isAlly = killerPlayer && snapshot.alliedPlayers.some((p) => p.summonerName === killerPlayer.summonerName);
        const objectiveName = eventName === "DragonKill" ? "dragão" : "barão";
        if (isAlly) {
          triggers.push(`roubamos ${objectiveName}`);
        } else {
          triggers.push(`roubaram ${objectiveName}`);
        }
      }
    }

    if (eventName === "FirstBlood") {
      const recipient = event?.Recipient as string | undefined;
      const isAlly = recipient && (
        snapshot.alliedPlayers.some((p) => p.summonerName === recipient) ||
        recipient === snapshot.activePlayerName
      );
      triggers.push(isAlly ? "first blood aliado" : "first blood inimigo");
    }

    if (eventName === "InhibRespawned") {
      const inhibName = event?.InhibRespawned as string | undefined ?? "";
      const allied = isAllyTurret(inhibName, snapshot.activePlayerTeam);
      if (!allied) {
        triggers.push("inibidor inimigo voltou");
      }
    }
  }

  return triggers;
}

const KEY_LEVELS = new Set<number>([6, 11, 16]);

function collectLevelTriggers(snapshot: GameSnapshot, state: LoopStateShape): string[] {
  const triggers: string[] = [];
  const currentLevel = snapshot.activePlayerLevel;

  if (currentLevel > state.lastActiveLevel && KEY_LEVELS.has(currentLevel)) {
    if (currentLevel === 6) {
      triggers.push("ult disponível");
    } else {
      triggers.push(`level up chave: ${currentLevel}`);
    }
  }

  // Detect enemy laner hitting 6 before us
  if (state.lastActiveLevel < 6 && currentLevel < 6) {
    const laneOpponent = snapshot.enemyPlayers.find(
      (p) => p.position === snapshot.activePlayerPosition
    );
    if (laneOpponent && laneOpponent.level >= 6 && state.lastEnemyLaneLevel < 6) {
      triggers.push(`inimigo ult antes: ${laneOpponent.championName}`);
      state.lastEnemyLaneLevel = 6;
    }
  }

  state.lastActiveLevel = currentLevel;
  return triggers;
}

function classifyCounterItem(itemName: string): string | null {
  for (const pattern of ITEM_TAGS.antiCura) {
    if (itemName.includes(pattern)) return "antiCura";
  }
  for (const pattern of ITEM_TAGS.armadura) {
    if (itemName.includes(pattern)) return "armadura";
  }
  for (const pattern of ITEM_TAGS.resistMagica) {
    if (itemName.includes(pattern)) return "resistMagica";
  }
  return null;
}

function collectItemTriggers(context: StrategicContext, state: LoopStateShape): string[] {
  const triggers: string[] = [];

  // Player completed new major item
  for (const item of context.activePlayer.majorItemDetails) {
    if (!state.seenActiveItemIds.has(item.id)) {
      state.seenActiveItemIds.add(item.id);
      triggers.push(`item fechado: ${item.name}`);
    }
  }

  // Enemy completed new major item
  for (const enemy of context.enemyBuilds ?? []) {
    const seenIds = state.seenEnemyItemIds.get(enemy.championName) ?? new Set();

    for (const item of enemy.majorItemDetails) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const counterTag = classifyCounterItem(item.name);
      if (counterTag && !state.seenEnemyCounterTags.has(counterTag)) {
        state.seenEnemyCounterTags.add(counterTag);
        triggers.push(`inimigo counter ${counterTag}`);
      } else {
        triggers.push(`inimigo item: ${enemy.championName}:${item.name}`);
      }
    }

    state.seenEnemyItemIds.set(enemy.championName, seenIds);
  }

  return triggers;
}

function collectPowerTriggers(context: StrategicContext, state: LoopStateShape): string[] {
  const triggers: string[] = [];
  const activeCount = context.activePlayer.majorItemCount;
  if (activeCount > state.lastActiveMajorItemCount && activeCount >= 1 && activeCount <= 3) {
    triggers.push(`você bateu powerspike de ${activeCount} ${activeCount > 1 ? "itens" : "item"}`);
  }
  state.lastActiveMajorItemCount = activeCount;

  for (const threat of context.enemyThreats ?? []) {
    const currentEnemyCount = threat.majorItemCount;
    const previousEnemyCount =
      state.enemyThreatItemCount.get(threat.championName) ?? 0;

    if (currentEnemyCount > previousEnemyCount && currentEnemyCount >= 2) {
      triggers.push(
        `${threat.championName} acelerou a build e virou ameaça maior`
      );
    }

    state.enemyThreatItemCount.set(threat.championName, currentEnemyCount);
  }

  return triggers;
}

function collectJungleTriggers(
  snapshot: GameSnapshot,
  state: LoopStateShape,
  newEvents: GameEvent[],
  playerLookup: Map<string, SnapshotPlayer>
): string[] {
  if (snapshot.activePlayerPosition !== "JUNGLE") return [];

  const triggers: string[] = [];

  for (const event of newEvents) {
    if (event?.EventName !== "ChampionKill") continue;

    const victim = typeof event.VictimName === "string" ? playerLookup.get(event.VictimName) : undefined;
    if (!victim) continue;

    // Enemy died — suggest pressuring their lane
    if (snapshot.enemyPlayers.some((p) => p.summonerName === victim.summonerName)) {
      const lane = victim.position ?? "UNKNOWN";
      if (lane !== "JUNGLE" && lane !== "UNKNOWN") {
        triggers.push(`gank oportunidade: ${lane.toLowerCase()} vulnerável, ${victim.championName} morreu`);
      }
    }
  }

  return triggers;
}

function collectDragonSoulTriggers(
  snapshot: GameSnapshot,
  state: LoopStateShape,
  playerLookup: Map<string, SnapshotPlayer>
): string[] {
  const triggers: string[] = [];
  const dragonKills = getEventsByName(snapshot, ["DragonKill"])
    .filter((ev) => ev.DragonType !== "Elder");

  let allyCount = 0;
  let enemyCount = 0;
  for (const ev of dragonKills) {
    const killerName = typeof ev.KillerName === "string" ? ev.KillerName : "";
    const killerPlayer = playerLookup.get(killerName);
    const isAlly = killerPlayer && snapshot.alliedPlayers.some((p) => p.summonerName === killerPlayer.summonerName);
    if (isAlly) allyCount++;
    else enemyCount++;
  }

  state.allyDragonKills = allyCount;
  state.enemyDragonKills = enemyCount;

  const SOUL_THRESHOLD = 4;
  const allyRemaining = SOUL_THRESHOLD - allyCount;
  const enemyRemaining = SOUL_THRESHOLD - enemyCount;

  if (allyRemaining >= 1 && allyRemaining <= 2 && snapshot.gameTime - state.lastAllyDragonSoulWarningAt >= 120) {
    state.lastAllyDragonSoulWarningAt = snapshot.gameTime;
    triggers.push(`alma do dragão aliada: falta ${allyRemaining}`);
  }

  if (enemyRemaining >= 1 && enemyRemaining <= 2 && snapshot.gameTime - state.lastEnemyDragonSoulWarningAt >= 120) {
    state.lastEnemyDragonSoulWarningAt = snapshot.gameTime;
    triggers.push(`alma do dragão inimiga: falta ${enemyRemaining}`);
  }

  return triggers;
}

function collectPerformanceTriggers(snapshot: GameSnapshot, state: LoopStateShape): string[] {
  const triggers: string[] = [];
  const activePlayer = snapshot.alliedPlayers.find((p) => p.summonerName === snapshot.activePlayerName);
  if (!activePlayer) return triggers;

  // CS/min check — only for laners, after 10 minutes, every 5 minutes
  if (
    snapshot.activePlayerPosition !== "JUNGLE" &&
    snapshot.activePlayerPosition !== "UNKNOWN" &&
    snapshot.gameTime >= 600 &&
    snapshot.gameTime - state.lastCsCheckAt >= 300
  ) {
    const csPerMin = activePlayer.creepScore / (snapshot.gameTime / 60);
    if (csPerMin < 5.5) {
      state.lastCsCheckAt = snapshot.gameTime;
      triggers.push("cs alerta");
    } else {
      state.lastCsCheckAt = snapshot.gameTime;
    }
  }

  // Ward score check — after 15 minutes, every 5 minutes
  if (snapshot.gameTime >= 900 && snapshot.gameTime - state.lastWardScoreCheckAt >= 300) {
    const wardScore = activePlayer.wardScore;
    const expectedMinWards = snapshot.gameTime / 120;
    if (wardScore < expectedMinWards) {
      state.lastWardScoreCheckAt = snapshot.gameTime;
      triggers.push("ward alerta");
    } else {
      state.lastWardScoreCheckAt = snapshot.gameTime;
    }
  }

  return triggers;
}

function collectLaneGoldTriggers(snapshot: GameSnapshot, state: LoopStateShape): string[] {
  const triggers: string[] = [];
  if (snapshot.gameTime < 600 || snapshot.gameTime - state.lastLaneGoldCheckAt < 120) return triggers;
  if (snapshot.activePlayerPosition === "JUNGLE" || snapshot.activePlayerPosition === "UNKNOWN") return triggers;

  const activePlayer = snapshot.alliedPlayers.find((p) => p.summonerName === snapshot.activePlayerName);
  if (!activePlayer) return triggers;

  const laneOpponent = snapshot.enemyPlayers.find((p) => p.position === snapshot.activePlayerPosition);
  if (!laneOpponent) return triggers;

  const csDiff = activePlayer.creepScore - laneOpponent.creepScore;
  const estimatedGoldDiff = csDiff * 20;

  if (estimatedGoldDiff <= -400) {
    state.lastLaneGoldCheckAt = snapshot.gameTime;
    const rounded = Math.round(Math.abs(estimatedGoldDiff) / 100) * 100;
    triggers.push(`lane ouro desvantagem: ${laneOpponent.championName}:${rounded}`);
  } else if (estimatedGoldDiff >= 400) {
    state.lastLaneGoldCheckAt = snapshot.gameTime;
    const rounded = Math.round(estimatedGoldDiff / 100) * 100;
    triggers.push(`lane ouro vantagem: ${laneOpponent.championName}:${rounded}`);
  } else {
    state.lastLaneGoldCheckAt = snapshot.gameTime;
  }

  return triggers;
}

export async function analyzeSnapshot(snapshot: GameSnapshot, state: LoopStateShape): Promise<AnalyzeSnapshotResult> {
  const newEvents = snapshot.events.slice(state.lastSeenEventCount);
  const playerLookup = getPlayerLookup(snapshot);
  const strategicContext = await buildStrategicContext(snapshot);
  const triggers = dedupe([
    ...collectObjectiveTriggers(snapshot, state),
    ...collectEventTriggers(snapshot, state, newEvents, playerLookup),
    ...collectJungleTriggers(snapshot, state, newEvents, playerLookup),
    ...collectPowerTriggers(strategicContext, state),
    ...collectItemTriggers(strategicContext, state),
    ...collectLevelTriggers(snapshot, state),
    ...collectDragonSoulTriggers(snapshot, state, playerLookup),
    ...collectPerformanceTriggers(snapshot, state),
    ...collectLaneGoldTriggers(snapshot, state)
  ]);

  if (!snapshot.activePlayerIsDead && triggers.length === 0 && snapshot.gameTime - state.lastMapReminderAt >= settings.mapReminderIntervalSeconds) {
    triggers.push("lembrete de mapa");
    state.lastMapReminderAt = snapshot.gameTime;
  }

  state.lastSeenEventCount = snapshot.events.length;
  state.lastAnalyzedGameTime = snapshot.gameTime;

  return {
    triggers: sortTriggersByUrgency(dedupe(triggers)),
    strategicContext
  };
}

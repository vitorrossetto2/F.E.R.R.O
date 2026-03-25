import { settings } from "./config.js";
import { ITEM_TAGS, pickModePhrase } from "./constants.js";
import { getItemCatalog } from "./ddragon.js";

const RESPAWN_BY_LEVEL = [
  10, 10, 12, 12, 14, 16, 20, 25, 28, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5
];

function getObjectiveThresholds() {
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

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function triggerUrgencyScore(trigger) {
  if (trigger.includes("nasceu agora")) return 0;
  if (trigger.includes("em 10 segundos")) return 1;
  if (trigger.includes("em 30 segundos")) return 2;
  if (trigger.includes("em 1 minuto")) return 3;
  if (trigger.includes("morreu, janela de")) return 4;
  if (trigger.includes("powerspike")) return 5;
  if (trigger.includes("acelerou a build")) return 6;
  if (trigger.includes("torre")) return 7;
  if (trigger === "lembrete de mapa") return 10;
  return 8;
}

function sortTriggersByUrgency(triggers) {
  return [...triggers].sort((a, b) => triggerUrgencyScore(a) - triggerUrgencyScore(b));
}

function getEventsByName(snapshot, names) {
  return snapshot.events.filter((event) => names.includes(event?.EventName));
}

function formatDuration(seconds) {
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

function getTimeIncreaseFactor(gameTimeSeconds) {
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

function estimateRespawnSeconds(level, gameTimeSeconds) {
  const base = RESPAWN_BY_LEVEL[Math.max(0, Math.min(17, Number(level || 1) - 1))];
  const total = base + (base * getTimeIncreaseFactor(gameTimeSeconds));
  return Math.ceil(total);
}

function getPlayerLookup(snapshot) {
  const players = [...snapshot.alliedPlayers, ...snapshot.enemyPlayers];
  const lookup = new Map();

  for (const player of players) {
    lookup.set(player.summonerName, player);
    lookup.set(player.championName, player);
  }

  return lookup;
}

function getDragonTimer(snapshot) {
  const dragonKills = getEventsByName(snapshot, ["DragonKill"]);
  if (dragonKills.length === 0) {
    return settings.dragonFirstSpawnSeconds;
  }

  const lastKill = dragonKills[dragonKills.length - 1];
  return Number(lastKill.EventTime ?? 0) + settings.dragonRespawnSeconds;
}

function getBaronTimer(snapshot) {
  const baronKills = getEventsByName(snapshot, ["BaronKill"]);
  if (baronKills.length === 0) {
    return settings.baronFirstSpawnSeconds;
  }

  const lastKill = baronKills[baronKills.length - 1];
  return Number(lastKill.EventTime ?? 0) + settings.baronRespawnSeconds;
}

function getGrubsTimer(snapshot) {
  if (snapshot.gameTime >= settings.grubsDespawnSeconds) {
    return null;
  }

  const grubKills = getEventsByName(snapshot, ["HordeKill", "VoidGrubKill"]);
  if (grubKills.length > 0) {
    return null;
  }

  return settings.grubsFirstSpawnSeconds;
}

function getHeraldTimer(snapshot) {
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

function getObjectiveStates(snapshot) {
  return [
    { name: "dragão", spawnAt: getDragonTimer(snapshot) },
    { name: "vastilarvas", spawnAt: getGrubsTimer(snapshot) },
    { name: "arauto", spawnAt: getHeraldTimer(snapshot) },
    { name: "barão", spawnAt: getBaronTimer(snapshot) }
  ].filter((objective) => objective.spawnAt !== null);
}

function collectObjectiveTriggers(snapshot, state) {
  const triggers = [];
  const previousGameTime = state.lastAnalyzedGameTime ?? null;

  for (const objective of getObjectiveStates(snapshot)) {
    const timeUntil = objective.spawnAt - snapshot.gameTime;
    const previousTimeUntil =
      previousGameTime === null ? null : objective.spawnAt - previousGameTime;

    for (const window of getObjectiveThresholds()) {
      const key = `${objective.name}:${objective.spawnAt}:${window.label}`;

      const crossedThreshold =
        previousTimeUntil !== null &&
        previousTimeUntil > window.threshold &&
        timeUntil <= window.threshold;

      const firstSeenInsideThreshold =
        previousTimeUntil === null &&
        timeUntil <= window.threshold &&
        timeUntil >= window.threshold - (settings.pollIntervalSeconds * 2);

      if ((crossedThreshold || firstSeenInsideThreshold) && !state.announcedKeys.has(key)) {
        state.announcedKeys.add(key);
        triggers.push(window.render(objective.name));
      }
    }
  }

  return triggers;
}

function detectLane(turretName) {
  const normalized = (turretName ?? "").toUpperCase();
  // Riot format: Turret_TOrder_L1_P3 where L0=top, L1=mid, L2=bot
  if (normalized.includes("_L1_") || normalized.includes("_MID_") || normalized.endsWith("_MID")) return "mid";
  if (normalized.includes("_L0_") || normalized.includes("_TOP_") || normalized.includes("_C_TOP") || normalized.endsWith("_TOP")) return "top";
  if (normalized.includes("_L2_") || normalized.includes("_BOT_") || normalized.includes("_C_BOT") || normalized.endsWith("_BOT")) return "bot";
  return "side";
}

function normalizeLaneForPlayerPerspective(lane, playerTeam) {
  if (playerTeam !== "CHAOS") return lane;
  if (lane === "top") return "bot";
  if (lane === "bot") return "top";
  return lane;
}

function isAllyTurret(turretName, playerTeam) {
  const normalized = (turretName ?? "").toUpperCase();
  const turretTeam = normalized.includes("TORDER") ? "ORDER" : "CHAOS";
  return turretTeam === (playerTeam ?? "ORDER").toUpperCase();
}

function turretRotationHint(lane, snapshot, allied) {
  const perspectiveLane = normalizeLaneForPlayerPerspective(lane, snapshot.activePlayerTeam);

  if (allied) {
    if (perspectiveLane === "mid") return pickModePhrase("torrePerdidaMid");
    if (perspectiveLane === "top") return pickModePhrase("torrePerdidaTop");
    if (perspectiveLane === "bot") return pickModePhrase("torrePerdidaBot");
    return pickModePhrase("torrePerdidaGenerica").replace("{lane}", perspectiveLane);
  }

  const nextDragonAt = getDragonTimer(snapshot);
  const nextBaronAt = getBaronTimer(snapshot);
  const dragonSoon = nextDragonAt !== null && nextDragonAt - snapshot.gameTime <= 90;
  const baronSoon = nextBaronAt !== null && nextBaronAt - snapshot.gameTime <= 90;

  if (perspectiveLane === "mid") return pickModePhrase("torreMid");
  if (perspectiveLane === "top" && dragonSoon) return pickModePhrase("torreTopDragao");
  if (perspectiveLane === "bot" && baronSoon) return pickModePhrase("torreBotBarao");

  return pickModePhrase("torreGenerica").replace("{lane}", perspectiveLane);
}

function isMajorItem(definition) {
  if (!definition) return false;

  const tags = definition.tags ?? [];
  if (tags.includes("Consumable") || tags.includes("Trinket")) {
    return false;
  }

  if (tags.includes("Boots")) {
    return true;
  }

  const totalGold = Number(definition.gold?.total ?? 0);
  const upgradesInto = Array.isArray(definition.into) ? definition.into : [];
  return upgradesInto.length === 0 && totalGold >= 2200;
}

function summarizeBuild(player, itemCatalog) {
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

function combatScore(player, build) {
  return (
    (player.kills * 3) +
    (player.assists * 1.5) -
    (player.deaths * 2) +
    player.level +
    (build.majorItemCount * 4)
  );
}

async function buildStrategicContext(snapshot) {
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

function collectEventTriggers(snapshot, state, newEvents, playerLookup) {
  const triggers = [];

  for (const event of newEvents) {
    const eventName = event?.EventName;

    if (eventName === "ChampionKill") {
      const victim = playerLookup.get(event?.VictimName);
      if (victim && snapshot.enemyPlayers.some((player) => player.summonerName === victim.summonerName)) {
        const respawnSeconds = estimateRespawnSeconds(victim.level, snapshot.gameTime);
        triggers.push(
          `${victim.championName} morreu, janela de ${formatDuration(respawnSeconds)} antes dele voltar`
        );
      }

      if (event?.VictimName === snapshot.activePlayerName) {
        state.playerDeathCount = (state.playerDeathCount ?? 0) + 1;
        const killerPlayer = playerLookup.get(event?.KillerName);
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
      const allied = isAllyTurret(turretName, snapshot.activePlayerTeam);
      triggers.push(turretRotationHint(lane, snapshot, allied));
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
  }

  return triggers;
}

const KEY_LEVELS = new Set([6, 11, 16]);

function collectLevelTriggers(snapshot, state) {
  const triggers = [];
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
    const enemyHit6 = snapshot.enemyPlayers.find(
      (p) => p.level >= 6 && (state.lastEnemyLaneLevel < 6)
    );
    if (enemyHit6) {
      triggers.push(`inimigo ult antes: ${enemyHit6.championName}`);
      state.lastEnemyLaneLevel = 6;
    }
  }

  state.lastActiveLevel = currentLevel;
  return triggers;
}

function classifyCounterItem(itemName) {
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

function collectItemTriggers(context, state) {
  const triggers = [];

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

function collectPowerTriggers(context, state) {
  const triggers = [];
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

export async function analyzeSnapshot(snapshot, state) {
  const newEvents = snapshot.events.slice(state.lastSeenEventCount);
  const playerLookup = getPlayerLookup(snapshot);
  const strategicContext = await buildStrategicContext(snapshot);
  const triggers = dedupe([
    ...collectObjectiveTriggers(snapshot, state),
    ...collectEventTriggers(snapshot, state, newEvents, playerLookup),
    ...collectPowerTriggers(strategicContext, state),
    ...collectItemTriggers(strategicContext, state),
    ...collectLevelTriggers(snapshot, state)
  ]);

  if (!snapshot.activePlayerIsDead && snapshot.gameTime - state.lastMapReminderAt >= settings.mapReminderIntervalSeconds) {
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

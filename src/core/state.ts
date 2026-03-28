import type { LoopStateShape } from "./types";
import { CATEGORY_PRIORITIES, COOLDOWN_GROUPS, GROUP_COOLDOWN_SECONDS } from "./constants";

export class LoopState implements LoopStateShape {
  lastCoachingAt = 0;
  lastMapReminderAt = 0;
  lastSeenEventCount = 0;
  lastActiveMajorItemCount = 0;
  enemyThreatItemCount = new Map<string, number>();
  announcedKeys = new Set<string>();
  lastAnalyzedGameTime: number | null = null;
  playerDeathCount = 0;
  matchupDone = false;
  openingGreetingDone = false;
  lastActiveLevel = 0;
  lastEnemyLaneLevel = 0;
  seenActiveItemIds = new Set<number>();
  seenEnemyItemIds = new Map<string, Set<number>>();
  seenEnemyCounterTags = new Set<string>();
  hasLoggedWaitingState = false;
  lastGameTime: number | null = null;
  lastMessageTimes = new Map<string, number>();
  pendingTriggers: string[] = [];
  lastSpeakGameTime = 0;
  lastGroupMessageTimes = new Map<string, number>();
  allyDragonKills = 0;
  enemyDragonKills = 0;
  lastDragonSoulWarningAt = 0;
  lastCsCheckAt = 0;
  lastCsValue = 0;
  lastWardScoreCheckAt = 0;
  lastWardScore = 0;
  lastLaneGoldCheckAt = 0;

  queueTriggers(triggers: string[]): void {
    for (const trigger of triggers) {
      this.pendingTriggers.push(trigger);
    }
    while (this.pendingTriggers.length > 2) {
      let lowestIdx = 0;
      let lowestPrio = Infinity;
      for (let i = 0; i < this.pendingTriggers.length; i++) {
        const cat = this._triggerCategory(this.pendingTriggers[i]);
        const prio = CATEGORY_PRIORITIES[cat] ?? 0;
        if (prio < lowestPrio) {
          lowestPrio = prio;
          lowestIdx = i;
        }
      }
      this.pendingTriggers.splice(lowestIdx, 1);
    }
  }

  private _triggerCategory(trigger: string): string {
    if (trigger === "lembrete de mapa") return "mapa";
    if (trigger === "ouro parado alto") return "ouroParado";
    if (trigger.startsWith("inimigo fed:")) return "inimigoFed";
    if (
      trigger.includes("em 1 minuto") ||
      trigger.includes("em 30 segundos") ||
      trigger.includes("em 10 segundos") ||
      trigger.includes("nasceu agora")
    )
      return "objetivo";
    if (trigger.includes("torre")) return "torre";
    if (trigger.includes("powerspike")) return "powerspike";
    if (trigger.startsWith("item fechado:")) return "itemFechado";
    if (trigger.startsWith("inimigo item:") || trigger.startsWith("inimigo counter"))
      return "inimigoItem";
    if (trigger.includes("acelerou a build")) return "inimigoBuild";
    if (trigger.includes("inibidor")) return "inibidor";
    if (trigger.startsWith("gank oportunidade:")) return "jungleGank";
    if (trigger.startsWith("lane precisa de ajuda:")) return "junglePressao";
    if (trigger === "ace inimigo" || trigger === "ace aliado") return "ace";
    if (trigger.startsWith("multikill ")) return "multikill";
    if (trigger.startsWith("roubaram ") || trigger.startsWith("roubamos ")) return "objetivoRoubo";
    if (trigger.startsWith("first blood")) return "firstBlood";
    if (trigger === "inibidor inimigo voltou") return "inibidorRespawn";
    if (trigger.startsWith("soul ")) return "dragonSoul";
    if (trigger === "cs alerta") return "csAlerta";
    if (trigger === "ward alerta") return "wardAlerta";
    if (trigger.startsWith("dragão tipo:")) return "dragonTipo";
    if (trigger.startsWith("lane ouro")) return "laneOuro";
    return "generico";
  }

  drainPendingTriggers(): string[] {
    const drained = this.pendingTriggers.splice(0);
    return drained;
  }

  canRepeatMessage(messageKey: string, gameTime: number, cooldownSeconds: number): boolean {
    const lastTime = this.lastMessageTimes.get(messageKey) ?? 0;
    return gameTime - lastTime >= cooldownSeconds;
  }

  markMessageSpoken(messageKey: string, gameTime: number): void {
    this.lastMessageTimes.set(messageKey, gameTime);
  }

  canSpeakGlobal(gameTime: number): boolean {
    return gameTime - this.lastSpeakGameTime >= 12;
  }

  markGlobalSpeak(gameTime: number): void {
    this.lastSpeakGameTime = gameTime;
  }

  canRepeatGroup(category: string, gameTime: number): boolean {
    const groupName = COOLDOWN_GROUPS[category];
    if (!groupName) return true;
    const lastTime = this.lastGroupMessageTimes.get(groupName);
    if (lastTime === undefined) return true;
    return gameTime - lastTime >= GROUP_COOLDOWN_SECONDS;
  }

  markGroupSpoken(groupName: string, gameTime: number): void {
    this.lastGroupMessageTimes.set(groupName, gameTime);
  }

  reset(): void {
    this.lastCoachingAt = 0;
    this.lastMapReminderAt = 0;
    this.lastSeenEventCount = 0;
    this.lastActiveMajorItemCount = 0;
    this.enemyThreatItemCount = new Map();
    this.announcedKeys = new Set();
    this.lastAnalyzedGameTime = null;
    this.lastGameTime = null;
    this.playerDeathCount = 0;
    this.matchupDone = false;
    this.openingGreetingDone = false;
    this.lastActiveLevel = 0;
    this.lastEnemyLaneLevel = 0;
    this.seenActiveItemIds = new Set();
    this.seenEnemyItemIds = new Map();
    this.seenEnemyCounterTags = new Set();
    this.lastMessageTimes = new Map();
    this.pendingTriggers = [];
    this.lastSpeakGameTime = 0;
    this.lastGroupMessageTimes = new Map();
    this.allyDragonKills = 0;
    this.enemyDragonKills = 0;
    this.lastDragonSoulWarningAt = 0;
    this.lastCsCheckAt = 0;
    this.lastCsValue = 0;
    this.lastWardScoreCheckAt = 0;
    this.lastWardScore = 0;
    this.lastLaneGoldCheckAt = 0;
  }

  detectGameReset(currentGameTime: number): boolean {
    if (this.lastGameTime !== null && currentGameTime < this.lastGameTime - 10) {
      return true;
    }
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import type { LoopStateShape } from "./types";

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

  queueTriggers(triggers: string[]): void {
    this.pendingTriggers.push(...triggers);
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

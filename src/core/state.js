export class LoopState {
  lastCoachingAt = 0;
  lastMapReminderAt = 0;
  lastSeenEventCount = 0;
  lastActiveMajorItemCount = 0;
  enemyThreatItemCount = new Map();
  announcedKeys = new Set();
  lastAnalyzedGameTime = null;
  playerDeathCount = 0;
  matchupDone = false;
  openingGreetingDone = false;
  lastActiveLevel = 0;
  lastEnemyLaneLevel = 0;
  seenActiveItemIds = new Set();
  seenEnemyItemIds = new Map();
  seenEnemyCounterTags = new Set();
  hasLoggedWaitingState = false;
  lastGameTime = null;
  lastMessageTimes = new Map();
  pendingTriggers = [];

  queueTriggers(triggers) {
    this.pendingTriggers.push(...triggers);
  }

  drainPendingTriggers() {
    const drained = this.pendingTriggers.splice(0);
    return drained;
  }

  canRepeatMessage(messageKey, gameTime, cooldownSeconds) {
    const lastTime = this.lastMessageTimes.get(messageKey) ?? 0;
    return gameTime - lastTime >= cooldownSeconds;
  }

  markMessageSpoken(messageKey, gameTime) {
    this.lastMessageTimes.set(messageKey, gameTime);
  }

  reset() {
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

  detectGameReset(currentGameTime) {
    if (this.lastGameTime !== null && currentGameTime < this.lastGameTime - 10) {
      return true;
    }
    return false;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

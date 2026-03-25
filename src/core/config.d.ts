export interface CoreSettings {
  zaiApiKey: string;
  zaiEndpoint: string;
  zaiModel: string;
  liveClientBaseUrl: string;
  ddragonVersionsUrl: string;
  ddragonCdnUrl: string;
  pollIntervalSeconds: number;
  coachingIntervalSeconds: number;
  mapReminderIntervalSeconds: number;
  stalledGoldThreshold: number;
  dragonFirstSpawnSeconds: number;
  dragonRespawnSeconds: number;
  grubsFirstSpawnSeconds: number;
  grubsDespawnSeconds: number;
  heraldFirstSpawnSeconds: number;
  heraldDespawnSeconds: number;
  baronFirstSpawnSeconds: number;
  baronRespawnSeconds: number;
  objectiveOneMinuteCallSeconds: number;
  objectiveThirtySecondsCallSeconds: number;
  objectiveTenSecondsCallSeconds: number;
  ttsEnabled: boolean;
  ttsProvider: string;
  ttsVoice?: string;
  piperExecutable: string;
  piperModelPath: string;
  piperSpeaker: number;
  elevenlabsApiKey: string;
  elevenlabsVoiceId: string;
  coachMessageMode: string;
  logsDir: string;
  logSnapshots: boolean;
  logLlmPayloads: boolean;
  simulationDurationSeconds: number;
  simulationStartGameTimeSeconds: number;
  simulationTickMs: number;
}

export const settings: CoreSettings;

export function getZaiBaseUrl(): string;

export function assertConfig(): void;

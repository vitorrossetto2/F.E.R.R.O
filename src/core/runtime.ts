import type { FerroConfig } from "../shared/types";
import type { CoreSettings } from "./types";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export function mapFerroConfigToCoreSettings(config: DeepPartial<FerroConfig> = {}): CoreSettings {
  const llm = config.llm ?? {};
  const llmProviders = llm.providers ?? {};
  const tts = config.tts ?? {};
  const ttsProviders = tts.providers ?? {};
  const piper = ttsProviders.piper ?? {};
  const elevenlabs = ttsProviders.elevenlabs ?? {};
  const system = ttsProviders.system ?? {};
  const game = config.game ?? {};
  const objectives = config.objectives ?? {};
  const logging = config.logging ?? {};
  const coach = config.coach ?? {};

  const ttsProvider =
    tts.activeProvider === "piper"
      ? "piper"
      : tts.activeProvider === "elevenlabs"
        ? "elevenlabs"
        : "say";

  const activeLlmProvider = llm.activeProvider && llm.activeProvider !== "none" ? llm.providers?.[llm.activeProvider] ?? llmProviders[llm.activeProvider] : null;

  return {
    zaiApiKey: activeLlmProvider?.apiKey ?? "",
    zaiEndpoint: activeLlmProvider?.endpoint ?? "",
    zaiModel: activeLlmProvider?.model ?? "",
    liveClientBaseUrl: "https://127.0.0.1:2999",
    ddragonVersionsUrl: "https://ddragon.leagueoflegends.com/api/versions.json",
    ddragonCdnUrl: "https://ddragon.leagueoflegends.com/cdn",
    pollIntervalSeconds: game.pollIntervalSeconds ?? 5,
    coachingIntervalSeconds: game.coachingIntervalSeconds ?? 20,
    mapReminderIntervalSeconds: game.mapReminderIntervalSeconds ?? 45,
    stalledGoldThreshold: game.stalledGoldThreshold ?? 1500,
    dragonFirstSpawnSeconds: objectives.dragonFirstSpawn ?? 300,
    dragonRespawnSeconds: objectives.dragonRespawn ?? 300,
    grubsFirstSpawnSeconds: objectives.grubsFirstSpawn ?? 480,
    grubsDespawnSeconds: objectives.grubsDespawn ?? 885,
    heraldFirstSpawnSeconds: objectives.heraldFirstSpawn ?? 900,
    heraldDespawnSeconds: objectives.heraldDespawn ?? 1185,
    baronFirstSpawnSeconds: objectives.baronFirstSpawn ?? 1200,
    baronRespawnSeconds: objectives.baronRespawn ?? 360,
    objectiveOneMinuteCallSeconds: objectives.oneMinuteCall ?? 70,
    objectiveThirtySecondsCallSeconds: objectives.thirtySecondsCall ?? 35,
    objectiveTenSecondsCallSeconds: objectives.tenSecondsCall ?? 12,
    ttsEnabled: true,
    ttsProvider,
    ttsVolume: tts.volume ?? 0.8,
    ttsVoice: system.voice ?? "Microsoft Maria Desktop",
    piperExecutable: piper.executablePath ?? "piper",
    piperModelPath: piper.modelPath ?? "",
    piperSpeaker: piper.speaker ?? -1,
    elevenlabsApiKey: elevenlabs.apiKey ?? "",
    elevenlabsVoiceId: elevenlabs.voiceId ?? "",
    coachMessageMode: coach.messageMode ?? "serio",
    logsDir: logging.logsDir ?? "./logs",
    logSnapshots: logging.logSnapshots ?? true,
    logLlmPayloads: logging.logLlmPayloads ?? true,
    simulationDurationSeconds: 60,
    simulationStartGameTimeSeconds: 240,
    simulationTickMs: 1000
  };
}

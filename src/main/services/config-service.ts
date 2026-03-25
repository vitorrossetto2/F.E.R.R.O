import path from "path";
import os from "os";
import Store from "electron-store";
import type { MicaConfig } from "../../shared/types.js";

const MICAAI_DIR = path.join(os.homedir(), ".micaai");

const DEFAULT_CONFIG: MicaConfig = {
  llm: {
    activeProvider: "none",
    providers: {
      zai: {
        apiKey: "",
        endpoint: "https://api.z.ai/api/coding/paas/v4/chat/completions",
        model: "glm-5",
      },
      openai: {
        apiKey: "",
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o-mini",
      },
      gemini: {
        apiKey: "",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        model: "gemini-2.0-flash",
      },
    },
  },
  tts: {
    activeProvider: "piper",
    providers: {
      piper: {
        executablePath: path.join(MICAAI_DIR, "piper", "piper.exe"),
        modelPath: "",
        speaker: -1,
      },
      elevenlabs: { apiKey: "", voiceId: "" },
      system: { voice: "Microsoft Maria Desktop" },
    },
  },
  game: {
    pollIntervalSeconds: 5,
    coachingIntervalSeconds: 20,
    mapReminderIntervalSeconds: 45,
    stalledGoldThreshold: 1500,
  },
  objectives: {
    dragonFirstSpawn: 300,
    dragonRespawn: 300,
    grubsFirstSpawn: 480,
    grubsDespawn: 885,
    heraldFirstSpawn: 900,
    heraldDespawn: 1185,
    baronFirstSpawn: 1200,
    baronRespawn: 360,
    oneMinuteCall: 70,
    thirtySecondsCall: 35,
    tenSecondsCall: 12,
  },
  messages: {
    objetivo: { enabled: true, cooldownSeconds: 15 },
    torre: { enabled: true, cooldownSeconds: 30 },
    torrePerdida: { enabled: true, cooldownSeconds: 30 },
    morteJogador: { enabled: true, cooldownSeconds: 90 },
    morteStreak: { enabled: true, cooldownSeconds: 180 },
    itemFechado: { enabled: true, cooldownSeconds: 30 },
    inimigoItem: { enabled: true, cooldownSeconds: 60 },
    powerspike: { enabled: true, cooldownSeconds: 60 },
    mapa: { enabled: true, cooldownSeconds: 50 },
    inimigoFed: { enabled: true, cooldownSeconds: 120 },
    inimigoBuild: { enabled: true, cooldownSeconds: 120 },
    ouroParado: { enabled: true, cooldownSeconds: 120 },
    levelUp: { enabled: true, cooldownSeconds: 30 },
    inibidor: { enabled: true, cooldownSeconds: 60 },
    generico: { enabled: true, cooldownSeconds: 30 },
  },
  logging: {
    logsDir: path.join(MICAAI_DIR, "logs"),
    logSnapshots: true,
    logLlmPayloads: true,
  },
  app: {
    onboardingCompleted: false,
    piperInstalled: false,
    windowBounds: null,
  },
};

let store: Store<MicaConfig>;

export function initConfigStore(): Store<MicaConfig> {
  store = new Store<MicaConfig>({
    name: "config",
    defaults: DEFAULT_CONFIG,
  });
  return store;
}

export function getConfigStore(): Store<MicaConfig> {
  if (!store) return initConfigStore();
  return store;
}

export function getAll(): MicaConfig {
  return getConfigStore().store;
}

export function get<K extends keyof MicaConfig>(key: K): MicaConfig[K] {
  return getConfigStore().get(key);
}

export function set<K extends keyof MicaConfig>(key: K, value: MicaConfig[K]): void {
  getConfigStore().set(key, value);
}

export function setPath(path: string, value: unknown): void {
  getConfigStore().set(path as keyof MicaConfig, value as never);
}

export function reset(): void {
  getConfigStore().clear();
}

export function isFirstRun(): boolean {
  return !getConfigStore().get("app.piperInstalled" as keyof MicaConfig) &&
    getConfigStore().get("tts" as keyof MicaConfig) &&
    (getConfigStore().get("tts" as keyof MicaConfig) as MicaConfig["tts"]).activeProvider === "piper" &&
    !(getConfigStore().get("tts" as keyof MicaConfig) as MicaConfig["tts"]).providers.piper.modelPath;
}

import { describe, expect, it } from "vitest";
import type { FerroConfig } from "../src/shared/types.js";
import { MESSAGE_PRESETS } from "../src/renderer/features/messages/index.js";
import {
  countEnabled,
  formatDuration,
  getResolvedMessages,
  isElevenLabsConfigured,
  isPresetActive,
} from "../src/renderer/features/messages/index.js";

const baseConfig: FerroConfig = {
  llm: {
    activeProvider: "none",
    providers: {
      zai: { apiKey: "", endpoint: "", model: "glm-5" },
      openai: { apiKey: "", endpoint: "", model: "gpt-4o-mini" },
      gemini: { apiKey: "", endpoint: "", model: "gemini-2.0-flash" },
    },
  },
  tts: {
    activeProvider: "piper",
    volume: 0.8,
    providers: {
      piper: { executablePath: "", modelPath: "", speaker: -1 },
      elevenlabs: { apiKey: "", voiceId: "" },
      system: { voice: "Microsoft Maria Desktop" },
    },
  },
  coach: { messageMode: "serio" },
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
    logsDir: "",
    logSnapshots: true,
    logLlmPayloads: true,
  },
  app: {
    onboardingCompleted: true,
    windowBounds: null,
  },
};

describe("messages feature selectors", () => {
  it("hydrates all known categories from sparse config", () => {
    const resolved = getResolvedMessages({ objetivo: { enabled: false, cooldownSeconds: 99 } });
    expect(resolved.objetivo).toEqual({ enabled: false, cooldownSeconds: 99 });
    expect(resolved.generico.enabled).toBe(true);
  });

  it("recognizes active preset and counts enabled categories", () => {
    const preset = MESSAGE_PRESETS.find((entry) => entry.id === "equilibrado");
    expect(preset).toBeTruthy();
    expect(isPresetActive(preset!.config, preset!.config)).toBe(true);
    expect(countEnabled(preset!.config)).toBe(11);
  });

  it("formats duration and detects elevenlabs readiness", () => {
    expect(formatDuration(1945.46)).toBe("32m25s");
    expect(isElevenLabsConfigured(baseConfig)).toBe(false);

    const config = structuredClone(baseConfig);
    config.tts.activeProvider = "elevenlabs";
    config.tts.providers.elevenlabs.apiKey = "key";
    config.tts.providers.elevenlabs.voiceId = "voice-1";
    expect(isElevenLabsConfigured(config)).toBe(true);
  });
});

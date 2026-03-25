import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FerroConfig } from "../src/shared/types.js";
import LLMProviderPanel from "../src/renderer/components/settings/LLMProviderPanel.tsx";

const config: FerroConfig = {
  llm: {
    activeProvider: "zai",
    providers: {
      zai: { apiKey: "key", endpoint: "https://api.z.ai/api/coding/paas/v4/chat/completions", model: "glm-5-turbo" },
      openai: { apiKey: "", endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
      gemini: { apiKey: "", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash" },
    },
  },
  tts: {
    activeProvider: "piper",
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

describe("LLM provider panel", () => {
  it("renders price badges and explanation text", () => {
    const markup = renderToStaticMarkup(
      <LLMProviderPanel config={config} onUpdate={async () => {}} />
    );

    expect(markup).toContain("Por que usar LLM?");
    expect(markup).toContain("Gratuito");
    expect(markup).toContain("Pago");
  });
});

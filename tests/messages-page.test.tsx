import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ElevenLabsUsageSummary, FerroConfig } from "../src/shared/types.js";
import { MessagesContent } from "../src/renderer/pages/Messages.tsx";

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
    providers: {
      piper: { executablePath: "", modelPath: "", speaker: -1 },
      elevenlabs: { apiKey: "", voiceId: "" },
      system: { voice: "Microsoft Maria Desktop" },
    },
  },
  coach: {
    messageMode: "serio",
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
    logsDir: "",
    logSnapshots: true,
    logLlmPayloads: true,
  },
  app: {
    onboardingCompleted: true,
    windowBounds: null,
  },
};

describe("Messages page", () => {
  it("renders the global selector with all three message modes", () => {
    const markup = renderToStaticMarkup(
      <MessagesContent
        config={baseConfig}
        isElevenLabs={false}
        onToggle={() => {}}
        onSetCooldown={() => {}}
        onSetMessageMode={() => {}}
      />
    );

    expect(markup).toContain("Modo global");
    expect(markup).toContain("Sério");
    expect(markup).toContain("Meme");
    expect(markup).toContain("Puto");
  });

  it("renders the latest ElevenLabs usage summary when available", () => {
    const usageSummary: ElevenLabsUsageSummary = {
      sessionId: "2026-03-25T17-35-23-511Z",
      ttsCount: 86,
      totalChars: 3459,
      estimatedCredits: 3459,
      averageCharsPerMessage: 40.22,
      durationSeconds: 1945.46,
      costBRL: 3.17,
    };

    const markup = renderToStaticMarkup(
      <MessagesContent
        config={baseConfig}
        isElevenLabs={true}
        elevenLabsUsageSummary={usageSummary}
        onToggle={() => {}}
        onSetCooldown={() => {}}
        onSetMessageMode={() => {}}
      />
    );

    expect(markup).toContain("Última partida: ~3.459 créditos (~R$ 3,17)");
    expect(markup).toContain("Baseado no log mais recente: 86 falas em 32m25s.");
  });
});

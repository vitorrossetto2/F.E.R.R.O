import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ElevenLabsUsageSummary, FerroConfig } from "../src/shared/types.js";
import { MessagesContent } from "../src/renderer/pages/Messages.tsx";

const baseMessages = {
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
};

function createBaseConfig(): FerroConfig {
  return {
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
    messages: structuredClone(baseMessages),
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
}

function renderMessages(config: FerroConfig, usageSummary?: ElevenLabsUsageSummary | null) {
  return renderToStaticMarkup(
    <MessagesContent
      config={config}
      messages={config.messages as any}
      elevenLabsUsageSummary={usageSummary}
      onToggle={() => {}}
      onSetCooldown={() => {}}
      onSetMessageMode={() => {}}
      onApplyPreset={() => {}}
    />
  );
}

describe("Messages page", () => {
  it("renders mode selector as 'Modo de voz' with all voice modes", () => {
    const markup = renderMessages(createBaseConfig());

    expect(markup).toContain("Modo de voz");
    expect(markup).not.toContain("Modo global");
    expect(markup).toContain("Sério");
    expect(markup).toContain("Meme");
    expect(markup).toContain("Puto");
  });

  it("does not render the 'Cooldowns visíveis' counter", () => {
    const markup = renderMessages(createBaseConfig());
    expect(markup).not.toContain("Cooldowns visíveis");
  });

  it("hides voice cost when provider is not ElevenLabs", () => {
    const markup = renderMessages(createBaseConfig());
    expect(markup).not.toContain("Custo de voz");
  });

  it("hides voice cost when ElevenLabs is active but not fully configured", () => {
    const config = createBaseConfig();
    config.tts.activeProvider = "elevenlabs";
    config.tts.providers.elevenlabs.apiKey = "test-key";
    config.tts.providers.elevenlabs.voiceId = "";

    const markup = renderMessages(config);
    expect(markup).not.toContain("Custo de voz");
  });

  it("renders voice cost when ElevenLabs is fully configured", () => {
    const config = createBaseConfig();
    config.tts.activeProvider = "elevenlabs";
    config.tts.providers.elevenlabs.apiKey = "test-key";
    config.tts.providers.elevenlabs.voiceId = "voice-123";

    const usageSummary: ElevenLabsUsageSummary = {
      sessionId: "2026-03-25T17-35-23-511Z",
      ttsCount: 86,
      totalChars: 3459,
      estimatedCredits: 3459,
      averageCharsPerMessage: 40.22,
      durationSeconds: 1945.46,
      costBRL: 3.17,
    };

    const markup = renderMessages(config, usageSummary);
    expect(markup).toContain("Custo de voz");
    expect(markup).toContain("~R$ 3,17");
    expect(markup).toContain("86 falas em 32m25s");
  });

  it("recognizes preset Equilibrado with 11/15 active categories", () => {
    const config = createBaseConfig();
    config.messages = {
      ...config.messages,
      objetivo: { enabled: true, cooldownSeconds: 18 },
      mapa: { enabled: true, cooldownSeconds: 60 },
      torrePerdida: { enabled: false, cooldownSeconds: 30 },
      inimigoBuild: { enabled: false, cooldownSeconds: 120 },
      levelUp: { enabled: false, cooldownSeconds: 30 },
      generico: { enabled: false, cooldownSeconds: 30 },
    };

    const markup = renderMessages(config);
    expect(markup).toContain("11/15");
    expect(markup).toContain("Mantém bom contexto com menor ruído.");
  });

  it("renders key copy with proper accents", () => {
    const markup = renderMessages(createBaseConfig());
    expect(markup).toContain("intervalo próprio");
    expect(markup).toContain("Sequência de mortes");
    expect(markup).toContain("Dragão, Barão, Arauto e Vastilarvas.");
  });
});

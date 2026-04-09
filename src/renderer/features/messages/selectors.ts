import type { FerroConfig, MessageCategoryConfig } from "../../../shared/types";
import { CATEGORY_DEFINITIONS, DEFAULT_MESSAGE_CONFIG } from "./constants";
import type { MessageCategoryId } from "./types";

export function getResolvedMessages(
  messages: FerroConfig["messages"]
): Record<MessageCategoryId, MessageCategoryConfig> {
  return Object.fromEntries(
    CATEGORY_DEFINITIONS.map((category) => [
      category.id,
      messages[category.id] ?? DEFAULT_MESSAGE_CONFIG[category.id],
    ])
  ) as Record<MessageCategoryId, MessageCategoryConfig>;
}

export function estimateTheoreticalCost(messages: Record<MessageCategoryId, MessageCategoryConfig>) {
  const gameDurationSeconds = 1800;
  const averageCharsPerMessage = 75;
  const starterUsd = 5;
  const starterCredits = 30000;
  const brlPerUsd = 5.5;

  let totalMessages = 0;
  for (const category of CATEGORY_DEFINITIONS) {
    const config = messages[category.id];
    if (config.enabled) {
      totalMessages += Math.floor(gameDurationSeconds / config.cooldownSeconds);
    }
  }

  const estimatedCredits = totalMessages * averageCharsPerMessage;
  const costUSD = (estimatedCredits / starterCredits) * starterUsd;
  const costBRL = costUSD * brlPerUsd;

  return { estimatedCredits, costBRL };
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m${String(remainingSeconds).padStart(2, "0")}s`;
}

export function countEnabled(messages: Record<MessageCategoryId, MessageCategoryConfig>): number {
  return Object.values(messages).filter((config) => config.enabled).length;
}

export function isElevenLabsConfigured(config: FerroConfig): boolean {
  return (
    config.tts.activeProvider === "elevenlabs" &&
    config.tts.providers.elevenlabs.apiKey.trim().length > 0 &&
    config.tts.providers.elevenlabs.voiceId.trim().length > 0
  );
}

export function isPresetActive(
  messages: Record<MessageCategoryId, MessageCategoryConfig>,
  preset: Record<MessageCategoryId, MessageCategoryConfig>
): boolean {
  return CATEGORY_DEFINITIONS.every((category) => {
    const current = messages[category.id];
    const target = preset[category.id];
    return current.enabled === target.enabled && current.cooldownSeconds === target.cooldownSeconds;
  });
}

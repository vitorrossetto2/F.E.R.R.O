import { existsSync } from "fs";
import type { FerroConfig, StartupState, TTSProviderType } from "../../shared/types";
import { getAll } from "./config-service";
import { checkPiper } from "./piper-installer";

function isProviderReady(config: FerroConfig, piperBinaryInstalled: boolean, piperModelExists: boolean): boolean {
  const provider: TTSProviderType = config.tts.activeProvider;

  if (provider === "system") {
    return Boolean(config.tts.providers.system.voice);
  }

  if (provider === "elevenlabs") {
    return Boolean(
      config.tts.providers.elevenlabs.apiKey.trim() &&
      config.tts.providers.elevenlabs.voiceId.trim()
    );
  }

  return piperBinaryInstalled && piperModelExists;
}

export function getStartupState(config: FerroConfig = getAll()): StartupState {
  const onboardingCompleted = config.app.onboardingCompleted;
  const needsOnboarding = !onboardingCompleted;
  const piperBinaryInstalled = checkPiper().installed;
  const piperModelPath = config.tts.providers.piper.modelPath;
  const piperModelConfigured = Boolean(piperModelPath);
  const piperModelExists = piperModelConfigured && existsSync(piperModelPath);

  return {
    onboardingCompleted,
    needsOnboarding,
    piperBinaryInstalled,
    piperModelConfigured,
    piperModelExists,
    activeTtsProvider: config.tts.activeProvider,
    engineAutoStartAllowed: onboardingCompleted && isProviderReady(config, piperBinaryInstalled, piperModelExists),
  };
}

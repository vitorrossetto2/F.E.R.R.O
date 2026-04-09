import { ipcMain } from "electron";
import path from "path";
import { IPC } from "../../shared/channels";
import { runLlmTextRequest } from "../../core/llm";
import * as configService from "../services/config-service";
import { populateEnvFromConfig } from "../lib/settings-bridge";
import { getPiperDir, getVoicesDir, installPiper, PIPER_VOICES } from "../services/piper-installer";
import { listElevenLabsVoices, listPiperVoices, listSystemVoices } from "../services/voice-list-service";
import { emitConfigChanged, keyFingerprint, log, normalizeTtsProvider, safeAsciiPreview, type IpcHandlerContext } from "./shared";

const TAG = "[IPC]";

export function registerVoiceHandlers({ mainWindow }: IpcHandlerContext): void {
  ipcMain.handle(IPC.VOICES_LIST_PIPER, async () => {
    const voices = await listPiperVoices();
    log("voices:list-piper found", voices.length, "voices");
    return voices;
  });

  ipcMain.handle(IPC.VOICES_LIST_ELEVENLABS, async (_event, apiKey: string) => {
    const started = Date.now();
    const fingerprint = keyFingerprint(apiKey);
    log("voices:list-elevenlabs start", "key:", fingerprint);
    try {
      const voices = await listElevenLabsVoices(apiKey);
      const elapsed = Date.now() - started;
      const sample = voices.slice(0, 3).map((voice) => `${voice.name}(${voice.id.slice(0, 6)}...)`).join(", ");
      log(
        "voices:list-elevenlabs done",
        "count:", voices.length,
        "ms:", elapsed,
        sample ? "sample:" : "",
        sample || "",
      );
      return voices;
    } catch (error) {
      const elapsed = Date.now() - started;
      console.error(TAG, "voices:list-elevenlabs error after", elapsed, "ms:", (error as Error).message);
      return [];
    }
  });

  ipcMain.handle(IPC.VOICES_LIST_SYSTEM, async () => {
    const voices = await listSystemVoices();
    log("voices:list-system found", voices.length, "voices");
    return voices;
  });

  ipcMain.handle(IPC.TTS_TEST, async (_event, provider: string, text: string) => {
    log("tts:test provider:", provider, "text:", safeAsciiPreview(text));
    try {
      populateEnvFromConfig();
      const config = configService.getAll();
      const configProvider =
        config.tts.activeProvider === "piper"
          ? "piper"
          : config.tts.activeProvider === "elevenlabs"
            ? "elevenlabs"
            : "say";
      const requestedProvider = normalizeTtsProvider(provider);
      const ttsProvider = requestedProvider;

      if (requestedProvider !== configProvider) {
        log("tts:test provider mismatch", "requested:", requestedProvider, "config:", configProvider);
      }

      if (ttsProvider === "piper" && !config.tts.providers.piper.modelPath) {
        const piperVoices = await listPiperVoices();
        if (piperVoices.length > 0) {
          const fallbackModelPath = piperVoices[0].id;
          configService.setPath("tts.providers.piper.modelPath", fallbackModelPath);
          log("tts:test auto-selected piper model:", fallbackModelPath);
        }
      }

      const configMod = await import("../../core/config");
      const currentConfig = configService.getAll();

      configMod.settings.ttsProvider = ttsProvider;
      configMod.settings.ttsEnabled = true;
      configMod.settings.piperExecutable = currentConfig.tts.providers.piper.executablePath;
      configMod.settings.piperModelPath = currentConfig.tts.providers.piper.modelPath;
      configMod.settings.piperSpeaker = currentConfig.tts.providers.piper.speaker;
      configMod.settings.elevenlabsApiKey = currentConfig.tts.providers.elevenlabs.apiKey;
      configMod.settings.elevenlabsVoiceId = currentConfig.tts.providers.elevenlabs.voiceId;
      configMod.settings.ttsVoice = currentConfig.tts.providers.system.voice;

      log(
        "tts:test using",
        ttsProvider,
        "voiceId:",
        currentConfig.tts.providers.elevenlabs.voiceId || "(none)",
        "systemVoice:",
        currentConfig.tts.providers.system.voice || "(default)",
        "piperModel:",
        currentConfig.tts.providers.piper.modelPath || "(none)",
      );

      const voiceMod = await import("../../core/voice");
      const result = await voiceMod.speak(text);
      log("tts:test success, provider:", result?.provider, "generateMs:", result?.generateMs);
      return { ok: true, provider: result?.provider, generateMs: result?.generateMs };
    } catch (error) {
      console.error(TAG, "tts:test error:", (error as Error).message);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC.LLM_TEST, async (_event, provider: string) => {
    log("llm:test provider:", provider);
    try {
      const config = configService.getAll();
      const providerKey = provider as "zai" | "openai" | "gemini";
      const providerConfig = config.llm.providers[providerKey];
      if (!providerConfig?.apiKey) {
        log("llm:test no API key for", provider);
        return { ok: false, error: "API key nÃ£o configurada" };
      }

      const start = Date.now();
      const result = await runLlmTextRequest({
        apiKey: providerConfig.apiKey,
        endpoint: providerConfig.endpoint,
        model: providerConfig.model,
        label: `ipc:${provider}`,
        messages: [{ role: "user", content: "Responda apenas: OK" }],
        maxOutputTokens: 16,
      });
      const ms = Date.now() - start;
      log("llm:test success in", ms, "ms, transport:", result.transport, "response:", result.text);
      return { ok: true, response: result.text, ms };
    } catch (error) {
      console.error(TAG, "llm:test error:", (error as Error).message);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC.LLM_TEST_COACHING, async () => {
    try {
      const cfg = configService.getAll();
      if (cfg.llm.activeProvider === "none") {
        return { ok: false, error: "LLM nÃ£o configurada" };
      }

      const [coachMod, configMod] = await Promise.all([
        import("../../core/coach"),
        import("../../core/config"),
      ]);

      const llm = cfg.llm.providers[cfg.llm.activeProvider];
      configMod.settings.zaiApiKey = llm.apiKey;
      configMod.settings.zaiEndpoint = llm.endpoint;
      configMod.settings.zaiModel = llm.model;
      configMod.settings.coachMessageMode = cfg.coach.messageMode;

      const tip = await coachMod.getMatchupTipWithFallback({
        gameTime: 50,
        activePlayerName: "Jogador",
        activePlayerChampion: "Jinx",
        activePlayerLevel: 3,
        activePlayerIsDead: false,
        activePlayerRespawnTimer: 0,
        activePlayerGold: 1200,
        activePlayerTeam: "ORDER",
        activePlayerKda: "1/0/2",
        activePlayerPosition: "BOTTOM",
        alliedPlayers: [],
        enemyPlayers: [
          { summonerName: "E1", championName: "Draven", level: 3, kills: 2, deaths: 0, assists: 1, creepScore: 30, currentGold: 1500, items: [], position: "BOTTOM", wardScore: 0 },
          { summonerName: "E2", championName: "Leona", level: 3, kills: 0, deaths: 1, assists: 2, creepScore: 10, currentGold: 800, items: [], position: "UTILITY", wardScore: 0 },
          { summonerName: "E3", championName: "Zed", level: 4, kills: 3, deaths: 0, assists: 0, creepScore: 45, currentGold: 2000, items: [], position: "MIDDLE", wardScore: 0 },
          { summonerName: "E4", championName: "Darius", level: 3, kills: 0, deaths: 0, assists: 0, creepScore: 35, currentGold: 1100, items: [], position: "TOP", wardScore: 0 },
          { summonerName: "E5", championName: "Lee Sin", level: 4, kills: 1, deaths: 0, assists: 1, creepScore: 25, currentGold: 1300, items: [], position: "JUNGLE", wardScore: 0 },
        ],
        events: [],
      });

      if (!tip) {
        return { ok: false, error: "LLM retornou resposta vazia" };
      }

      return { ok: true, message: tip.message, llmMs: tip.llmMs };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(IPC.PIPER_AVAILABLE_VOICES, () => PIPER_VOICES);

  ipcMain.handle(IPC.PIPER_INSTALL, async (_event, voiceId: string) => {
    log("piper:install voiceId:", voiceId);
    const result = await installPiper(voiceId, mainWindow);
    if (result.ok) {
      const voice = PIPER_VOICES.find((item) => item.id === voiceId);
      if (voice) {
        const voicesDir = getVoicesDir();
        const piperDir = getPiperDir();
        const exePath = path.join(piperDir, "piper.exe");
        const modelPath = path.join(voicesDir, `${voice.file}.onnx`);
        configService.setPath("tts.providers.piper.executablePath", exePath);
        configService.setPath("tts.providers.piper.modelPath", modelPath);
        emitConfigChanged(mainWindow, { path: "tts.providers.piper.executablePath", value: exePath });
        emitConfigChanged(mainWindow, { path: "tts.providers.piper.modelPath", value: modelPath });
        log("piper:install success. exe:", exePath, "model:", modelPath);
      }
    } else {
      console.error(TAG, "piper:install failed:", result.error);
    }
    return result;
  });
}

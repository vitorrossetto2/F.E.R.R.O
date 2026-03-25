import { ipcMain, dialog, app, type BrowserWindow } from "electron";
import { IPC } from "../../shared/channels.js";
import * as configService from "../services/config-service.js";
import { engine } from "../services/engine.js";
import { checkPiper, installPiper, PIPER_VOICES, getVoicesDir, getPiperDir } from "../services/piper-installer.js";
import { listPiperVoices, listElevenLabsVoices, listSystemVoices } from "../services/voice-list-service.js";
import { populateEnvFromConfig } from "../lib/settings-bridge.js";
import path from "path";

const TAG = "[IPC]";
function log(...args: unknown[]) { console.log(TAG, ...args); }

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ── Config ──────────────────────────────────────────
  ipcMain.handle(IPC.CONFIG_GET, () => {
    return configService.getAll();
  });

  ipcMain.handle(IPC.CONFIG_SET, (_e, configPath: string, value: unknown) => {
    log("config:set", configPath, typeof value === "string" && value.length > 20 ? value.slice(0, 20) + "..." : value);
    configService.setPath(configPath, value);
    mainWindow.webContents.send(IPC.CONFIG_CHANGED, { path: configPath, value });
  });

  ipcMain.handle(IPC.CONFIG_RESET, () => {
    log("config:reset");
    configService.reset();
  });

  // ── Engine ──────────────────────────────────────────
  ipcMain.handle(IPC.ENGINE_START, async () => {
    log("engine:start");
    await engine.start();
  });

  ipcMain.handle(IPC.ENGINE_STOP, () => {
    log("engine:stop");
    engine.stop();
  });

  ipcMain.handle(IPC.ENGINE_STATUS, () => engine.engineState);

  // ── Logs ────────────────────────────────────────────
  ipcMain.handle(IPC.LOGS_GET, () => []);
  ipcMain.handle(IPC.LOGS_CLEAR, () => {});

  // ── Match Analysis ──────────────────────────────────
  ipcMain.handle(IPC.MATCH_LIST, () => []);
  ipcMain.handle(IPC.MATCH_GET, () => null);

  ipcMain.handle(IPC.MATCH_LAST, async () => {
    try {
      const config = configService.getAll();
      const gameDir = path.join(config.logging.logsDir, "game");
      log("match:last loading from", gameDir);
      const mod = await import("../../core/match-analyzer.js");
      const sessions = await mod.listSessionSummaries(gameDir);
      if (!sessions || sessions.length === 0) {
        log("match:last no sessions found");
        return null;
      }
      const last = sessions[sessions.length - 1];
      log("match:last analyzing session", last.sessionId);
      const analysis = await mod.getSessionAnalysis(gameDir, last.sessionId);
      return analysis;
    } catch (error) {
      console.error(TAG, "match:last error:", (error as Error).message);
      return null;
    }
  });

  // ── Voice listing ───────────────────────────────────
  ipcMain.handle(IPC.VOICES_LIST_PIPER, async () => {
    const voices = await listPiperVoices();
    log("voices:list-piper found", voices.length, "voices");
    return voices;
  });

  ipcMain.handle(IPC.VOICES_LIST_ELEVENLABS, async (_e, apiKey: string) => {
    log("voices:list-elevenlabs", apiKey ? "(key provided)" : "(no key)");
    const voices = await listElevenLabsVoices(apiKey);
    log("voices:list-elevenlabs found", voices.length, "voices");
    return voices;
  });

  ipcMain.handle(IPC.VOICES_LIST_SYSTEM, async () => {
    const voices = await listSystemVoices();
    log("voices:list-system found", voices.length, "voices");
    return voices;
  });

  // ── TTS Test ────────────────────────────────────────
  ipcMain.handle(IPC.TTS_TEST, async (_e, _provider: string, text: string) => {
    log("tts:test provider:", _provider, "text:", text.slice(0, 30) + "...");
    try {
      populateEnvFromConfig();
      const configMod = await import("../../core/config.js");
      const config = configService.getAll();
      const ttsProvider = config.tts.activeProvider === "piper" ? "piper" : "say";

      // Mutate cached settings to reflect current config
      configMod.settings.ttsProvider = ttsProvider;
      configMod.settings.ttsEnabled = true;
      configMod.settings.piperExecutable = config.tts.providers.piper.executablePath;
      configMod.settings.piperModelPath = config.tts.providers.piper.modelPath;
      configMod.settings.piperSpeaker = config.tts.providers.piper.speaker;
      configMod.settings.ttsVoice = config.tts.providers.system.voice;

      log("tts:test using", ttsProvider, "exe:", configMod.settings.piperExecutable, "model:", configMod.settings.piperModelPath);

      const voiceMod = await import("../../core/voice.js");
      const result = await voiceMod.speak(text);
      log("tts:test success, provider:", result?.provider, "generateMs:", result?.generateMs);
      return { ok: true, provider: result?.provider, generateMs: result?.generateMs };
    } catch (error) {
      console.error(TAG, "tts:test error:", (error as Error).message);
      return { ok: false, error: (error as Error).message };
    }
  });

  // ── LLM Test ────────────────────────────────────────
  ipcMain.handle(IPC.LLM_TEST, async (_e, provider: string) => {
    log("llm:test provider:", provider);
    try {
      const config = configService.getAll();
      const providerKey = provider as "zai" | "openai" | "gemini";
      const pConfig = config.llm.providers[providerKey];
      if (!pConfig?.apiKey) {
        log("llm:test no API key for", provider);
        return { ok: false, error: "API key não configurada" };
      }

      const OpenAI = (await import("openai")).default;
      const baseURL = pConfig.endpoint.replace(/\/chat\/completions\/?$/, "");
      log("llm:test calling", baseURL, "model:", pConfig.model);
      const client = new OpenAI({ apiKey: pConfig.apiKey, baseURL });

      const start = Date.now();
      const resp = await client.chat.completions.create({
        model: pConfig.model,
        messages: [{ role: "user", content: "Responda apenas: OK" }],
        max_tokens: 10,
      });
      const ms = Date.now() - start;
      const message = resp.choices?.[0]?.message?.content ?? "";
      log("llm:test success in", ms, "ms, response:", message);
      return { ok: true, response: message, ms };
    } catch (error) {
      console.error(TAG, "llm:test error:", (error as Error).message);
      return { ok: false, error: (error as Error).message };
    }
  });

  // ── Piper ───────────────────────────────────────────
  ipcMain.handle(IPC.PIPER_CHECK, () => {
    const status = checkPiper();
    log("piper:check installed:", status.installed, status.path ?? "");
    return status;
  });

  ipcMain.handle(IPC.PIPER_STATUS, () => checkPiper());
  ipcMain.handle(IPC.PIPER_AVAILABLE_VOICES, () => PIPER_VOICES);

  ipcMain.handle(IPC.PIPER_INSTALL, async (_e, voiceId: string) => {
    log("piper:install voiceId:", voiceId);
    const result = await installPiper(voiceId, mainWindow);
    if (result.ok) {
      const voice = PIPER_VOICES.find((v) => v.id === voiceId);
      if (voice) {
        const voicesDir = getVoicesDir();
        const piperDir = getPiperDir();
        const exePath = path.join(piperDir, "piper.exe");
        const modelPath = path.join(voicesDir, `${voice.file}.onnx`);
        configService.setPath("tts.providers.piper.executablePath", exePath);
        configService.setPath("tts.providers.piper.modelPath", modelPath);
        configService.setPath("app.piperInstalled", true);
        log("piper:install success. exe:", exePath, "model:", modelPath);
      }
    } else {
      console.error(TAG, "piper:install failed:", result.error);
    }
    return result;
  });

  // ── System ──────────────────────────────────────────
  ipcMain.handle(IPC.DIALOG_SELECT_DIR, async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.APP_IS_FIRST_RUN, () => {
    const first = configService.isFirstRun();
    log("app:isFirstRun:", first);
    return first;
  });

  ipcMain.handle(IPC.APP_COMPLETE_ONBOARDING, () => {
    log("app:completeOnboarding");
    configService.setPath("app.onboardingCompleted", true);
  });

  log("All IPC handlers registered");
}

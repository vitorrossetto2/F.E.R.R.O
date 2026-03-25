import { EventEmitter } from "events";
import type { BrowserWindow } from "electron";
import { IPC } from "../../shared/channels.js";
import type { EngineState, EngineStatus, EngineEvent, LogEntry } from "../../shared/types.js";
import { populateEnvFromConfig } from "../lib/settings-bridge.js";
import * as configService from "./config-service.js";

const OPENING_MATCHUP_TARGET_SECONDS = 50;
const OPENING_MATCHUP_MAX_SECONDS = 120;

// Core modules loaded once
let core: {
  analyzeSnapshot: (snapshot: unknown, state: unknown) => Promise<{ triggers: string[]; strategicContext: unknown }>;
  decideCoaching: (snapshot: unknown, triggers: string[], ctx: unknown) => Promise<Record<string, unknown>>;
  detectCategory: (priority: string) => string;
  getCategoryCooldown: (category: string) => number;
  getMatchupTip: (snapshot: unknown) => Promise<Record<string, unknown> | null>;
  getSnapshot: (logGame?: (...args: unknown[]) => void) => Promise<Record<string, unknown> | null>;
  speak: (text: string) => Promise<{ generateMs?: number; playMs?: number; provider?: string } | undefined>;
  createLogger: (mode?: string) => Promise<{ log: (...args: unknown[]) => Promise<void>; logGame: (...args: unknown[]) => Promise<void>; newSession: () => Promise<Record<string, unknown>>; filePath: string; gameFilePath: string }>;
  pickModePhrase: (key: string, mode?: string) => string;
  LoopState: new () => {
    lastCoachingAt: number; lastGameTime: number | null; hasLoggedWaitingState: boolean;
    matchupDone: boolean; openingGreetingDone: boolean; pendingTriggers: string[];
    queueTriggers: (t: string[]) => void; drainPendingTriggers: () => string[];
    canRepeatMessage: (c: string, t: number, cd: number) => boolean;
    markMessageSpoken: (c: string, t: number) => void;
    detectGameReset: (t: number) => boolean; reset: () => void;
    [key: string]: unknown;
  };
  settings: Record<string, unknown>;
} | null = null;

export class Engine extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private mainWindow: BrowserWindow | null = null;
  private state: InstanceType<NonNullable<typeof core>["LoopState"]> | null = null;
  private logger: Awaited<ReturnType<NonNullable<typeof core>["createLogger"]>> | null = null;

  public engineState: EngineState = {
    status: "idle",
    gameDetected: false,
    gameTime: 0,
    activeChampion: "",
    lastMessage: "",
    lastMessageSource: "",
    lastLLMMs: 0,
    lastTTSMs: 0,
    ttsStatus: "idle",
    llmStatus: configService.getAll().llm.activeProvider === "none" ? "disabled" : "idle",
    piperStatus: "missing",
    errorMessage: null,
  };

  setWindow(win: BrowserWindow) { this.mainWindow = win; }

  private send(event: EngineEvent) {
    this.emit("event", event);
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.ENGINE_EVENT, event);
    }
  }

  private log(entry: Partial<LogEntry> & { type: string }) {
    const full = { ts: new Date().toISOString(), sessionId: "", ...entry };
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC.LOGS_ENTRY, full);
    }
  }

  private setStatus(status: EngineStatus) {
    this.engineState.status = status;
    this.send({ type: "status_change", status });
  }

  private applyConfigToRuntime() {
    const cfg = configService.getAll();
    const llmEnabled = cfg.llm.activeProvider !== "none";
    const llm = llmEnabled ? cfg.llm.providers[cfg.llm.activeProvider] : null;

    populateEnvFromConfig();

    this.engineState.llmStatus = llmEnabled
      ? this.engineState.llmStatus === "calling"
        ? "calling"
        : "idle"
      : "disabled";
    this.engineState.piperStatus = cfg.tts.providers.piper.modelPath ? "installed" : "missing";

    if (!core) return;

    const s = core.settings;
    Object.assign(s, {
      zaiApiKey: llm?.apiKey ?? "",
      zaiEndpoint: llm?.endpoint ?? "",
      zaiModel: llm?.model ?? "",
      liveClientBaseUrl: "https://127.0.0.1:2999",
      pollIntervalSeconds: cfg.game.pollIntervalSeconds,
      coachingIntervalSeconds: cfg.game.coachingIntervalSeconds,
      mapReminderIntervalSeconds: cfg.game.mapReminderIntervalSeconds,
      stalledGoldThreshold: cfg.game.stalledGoldThreshold,
      dragonFirstSpawnSeconds: cfg.objectives.dragonFirstSpawn,
      dragonRespawnSeconds: cfg.objectives.dragonRespawn,
      grubsFirstSpawnSeconds: cfg.objectives.grubsFirstSpawn,
      grubsDespawnSeconds: cfg.objectives.grubsDespawn,
      heraldFirstSpawnSeconds: cfg.objectives.heraldFirstSpawn,
      heraldDespawnSeconds: cfg.objectives.heraldDespawn,
      baronFirstSpawnSeconds: cfg.objectives.baronFirstSpawn,
      baronRespawnSeconds: cfg.objectives.baronRespawn,
      objectiveOneMinuteCallSeconds: cfg.objectives.oneMinuteCall,
      objectiveThirtySecondsCallSeconds: cfg.objectives.thirtySecondsCall,
      objectiveTenSecondsCallSeconds: cfg.objectives.tenSecondsCall,
      ttsEnabled: true,
      ttsProvider:
        cfg.tts.activeProvider === "piper"
          ? "piper"
          : cfg.tts.activeProvider === "elevenlabs"
            ? "elevenlabs"
            : "say",
      ttsVoice: cfg.tts.providers.system.voice,
      piperExecutable: cfg.tts.providers.piper.executablePath,
      piperModelPath: cfg.tts.providers.piper.modelPath,
      piperSpeaker: cfg.tts.providers.piper.speaker,
      elevenlabsApiKey: cfg.tts.providers.elevenlabs.apiKey,
      elevenlabsVoiceId: cfg.tts.providers.elevenlabs.voiceId,
      coachMessageMode: cfg.coach.messageMode,
      logsDir: cfg.logging.logsDir,
      logSnapshots: cfg.logging.logSnapshots,
      logLlmPayloads: cfg.logging.logLlmPayloads,
    });
  }

  public syncConfig() {
    this.applyConfigToRuntime();
    this.send({ type: "status_change", status: this.engineState.status });
  }

  private async loadCore() {
    if (core) return;
    this.applyConfigToRuntime();

    const [analyzerMod, coachMod, gameMod, voiceMod, loggerMod, stateMod, configMod, constantsMod] =
      await Promise.all([
        import("../../core/analyzer.js"),
        import("../../core/coach.js"),
        import("../../core/game.js"),
        import("../../core/voice.js"),
        import("../../core/logger.js"),
        import("../../core/state.js"),
        import("../../core/config.js"),
        import("../../core/constants.js"),
      ]);

    console.log("[Engine] Core loaded. logsDir:", configMod.settings.logsDir, "piperExe:", configMod.settings.piperExecutable, "model:", configMod.settings.piperModelPath);

    core = {
      analyzeSnapshot: analyzerMod.analyzeSnapshot,
      decideCoaching: coachMod.decideCoaching,
      detectCategory: coachMod.detectCategory,
      getCategoryCooldown: coachMod.getCategoryCooldown,
      getMatchupTip: coachMod.getMatchupTip,
      getSnapshot: gameMod.getSnapshot,
      speak: voiceMod.speak,
      createLogger: loggerMod.createLogger,
      pickModePhrase: constantsMod.pickModePhrase,
      LoopState: stateMod.LoopState,
      settings: configMod.settings,
    };

    this.applyConfigToRuntime();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log("[Engine] Starting...");

    try {
      await this.loadCore();

      this.state = new core!.LoopState();
      this.logger = await core!.createLogger();

      this.engineState.piperStatus = (core!.settings.piperModelPath as string) ? "installed" : "missing";
      this.setStatus("waiting_for_game");

      await this.logger.log("coach_ready", { message: "Coach iniciado via Electron" });
      this.log({ type: "coach_ready", message: "Coach iniciado" });
      console.log("[Engine] Started. Polling every", core!.settings.pollIntervalSeconds, "s");

      const pollMs = (core!.settings.pollIntervalSeconds as number) * 1000;
      this.intervalId = setInterval(() => this.safeTick(), pollMs);
    } catch (err) {
      console.error("[Engine] Start failed:", (err as Error).message, (err as Error).stack);
      this.setStatus("error");
      this.engineState.errorMessage = (err as Error).message;
      this.send({ type: "error", message: (err as Error).message });
      this.running = false;
    }
  }

  private async safeTick() {
    if (!core || !this.state || !this.logger) return;
    if ((this as { _ticking?: boolean })._ticking) return;
    (this as { _ticking?: boolean })._ticking = true;
    try {
      await this.tick();
    } catch (err) {
      console.error("[Engine] Tick error:", (err as Error).message);
      this.log({ type: "engine_error", message: (err as Error).message });
    } finally {
      (this as { _ticking?: boolean })._ticking = false;
    }
  }

  private async tick() {
    const c = core!;
    const st = this.state!;
    const lg = this.logger!;

    const snapshot = await c.getSnapshot((...args: unknown[]) => lg.logGame(...args));

    // No game running
    if (!snapshot) {
      if (!st.hasLoggedWaitingState) {
        if (st.lastGameTime !== null) {
          await lg.log("game_ended", { lastGameTime: st.lastGameTime });
          st.reset();
          this.engineState.gameDetected = false;
          this.engineState.gameTime = 0;
          this.engineState.activeChampion = "";
          this.send({ type: "game_ended" });
        }
        await lg.log("waiting_for_game");
        st.hasLoggedWaitingState = true;
        this.log({ type: "waiting_for_game" });
      }
      this.setStatus("waiting_for_game");
      return;
    }

    // Game detected for first time
    if (st.hasLoggedWaitingState) {
      await lg.newSession();
      await lg.log("game_detected", {
        gameTime: snapshot.gameTime,
        activePlayer: snapshot.activePlayerName,
        champion: snapshot.activePlayerChampion,
      });
      st.hasLoggedWaitingState = false;
      this.send({ type: "game_detected", champion: snapshot.activePlayerChampion, gameTime: snapshot.gameTime });
      this.log({ type: "game_detected", gameTime: snapshot.gameTime as number, message: `Partida detectada: ${snapshot.activePlayerChampion}` });
      console.log("[Engine] Game detected:", snapshot.activePlayerChampion);
    }

    const gameTime = snapshot.gameTime as number;
    this.engineState.gameDetected = true;
    this.engineState.gameTime = gameTime;
    this.engineState.activeChampion = snapshot.activePlayerChampion as string;
    this.setStatus("coaching");

    // Game reset
    if (st.detectGameReset(gameTime)) {
      st.reset();
      await lg.newSession();
      await lg.log("game_reset", { newGameTime: gameTime });
      console.log("[Engine] Game reset detected");
    }
    st.lastGameTime = gameTime;

    // Opening messages
    const llmEnabled = configService.getAll().llm.activeProvider !== "none";
    if (!st.openingGreetingDone && gameTime < OPENING_MATCHUP_MAX_SECONDS) {
      st.openingGreetingDone = true;
      try {
        const greeting = c.pickModePhrase("inicioPartida");
        const tts = await c.speak(greeting);
        this.updateLastMessage(greeting, "heuristic", 0, tts?.generateMs ?? 0);
        this.log({ type: "coach_speak", gameTime, message: greeting });
      } catch (err) {
        console.error("[Engine] Opening greeting error:", (err as Error).message);
      }
    }

    if (!st.matchupDone && llmEnabled && gameTime >= OPENING_MATCHUP_TARGET_SECONDS && gameTime < OPENING_MATCHUP_MAX_SECONDS) {
      st.matchupDone = true;
      try {
        const matchup = await c.getMatchupTip(snapshot);
        if (matchup) {
          const tts = await c.speak(matchup.message as string);
          this.updateLastMessage(matchup.message as string, "llm", matchup.llmMs as number, tts?.generateMs ?? 0);
          this.log({ type: "coach_speak", gameTime, message: matchup.message as string });
          st.lastCoachingAt = gameTime;
        }
      } catch (err) {
        console.error("[Engine] Matchup error:", (err as Error).message);
      }
    }

    // Analyze
    const { triggers: newTriggers, strategicContext } = await c.analyzeSnapshot(snapshot, st);
    const pending = st.drainPendingTriggers();
    const triggers = [...new Set([...pending, ...newTriggers])];
    const settings = c.settings as Record<string, number>;
    const dueForCoaching = gameTime - (st.lastCoachingAt || 0) >= settings.coachingIntervalSeconds;

    // Log snapshot to system log
    if (c.settings.logSnapshots) {
      await lg.log("snapshot", {
        gameTime,
        champion: snapshot.activePlayerChampion,
        gold: snapshot.activePlayerGold,
        kda: snapshot.activePlayerKda,
        triggers,
        strategicContext,
      });
    }

    if (!dueForCoaching && triggers.length === 0) {
      await lg.log("loop_skip", { gameTime, reason: "sem gatilho e fora do intervalo" });
      return;
    }

    // Coach decision
    let decision: Record<string, unknown>;
    try {
      if (llmEnabled) {
        this.engineState.llmStatus = "calling";
      }
      // When LLM is disabled, clear the API key so coach.js skips LLM and uses fallback only
      if (!llmEnabled) {
        c.settings.zaiApiKey = "";
      }
      decision = await c.decideCoaching(snapshot, triggers, strategicContext);
      this.engineState.llmStatus = llmEnabled ? "idle" : "disabled";
    } catch (err) {
      this.engineState.llmStatus = llmEnabled ? "error" : "disabled";
      this.log({ type: "coach_error", gameTime, message: (err as Error).message });
      console.error("[Engine] Coach error:", (err as Error).message);
      return;
    }

    if (decision.priority && triggers.length > 1) {
      st.queueTriggers(triggers.filter((t) => t !== decision.priority));
    }

    await lg.log("coach_decision", {
      gameTime, triggers, priority: decision.priority,
      shouldSpeak: decision.shouldSpeak, reason: decision.reason,
      fallbackUsed: decision.fallbackUsed, skippedLlm: decision.skippedLlm,
      llmMs: decision.llmMs, llmError: decision.llmError,
    });
    this.log({ type: "coach_decision", gameTime, priority: decision.priority as string, shouldSpeak: decision.shouldSpeak as boolean });

    if (!decision.skippedLlm) {
      if (c.settings.logLlmPayloads) {
        await lg.log("llm_payload", {
          gameTime,
          prompt: decision.prompt,
          rawModelMessage: decision.rawModelMessage,
          llmMs: decision.llmMs,
          llmError: decision.llmError,
        });
      }

      if (decision.llmError) {
        this.send({ type: "llm_error", gameTime, error: decision.llmError, llmMs: decision.llmMs });
      } else {
        this.send({
          type: "llm_response",
          gameTime,
          llmMs: decision.llmMs,
          fallbackUsed: decision.fallbackUsed,
          rawModelMessage: decision.rawModelMessage,
        });
      }
    }

    if (decision.shouldSpeak) {
      const category = c.detectCategory(decision.priority as string);

      // Check user toggle
      const msgCfg = configService.getAll().messages[category];
      if (msgCfg && !msgCfg.enabled) {
        this.log({ type: "msg_skipped", gameTime, message: `Categoria "${category}" desabilitada` });
        return;
      }

      // Cooldown
      const cooldown = msgCfg?.cooldownSeconds ?? c.getCategoryCooldown(category);
      if (!st.canRepeatMessage(category, gameTime, cooldown)) {
        st.queueTriggers(triggers.filter((t) => c.detectCategory(t) !== category));
        return;
      }
      st.markMessageSpoken(category, gameTime);

      // Speak
      this.send({ type: "tts_start", message: decision.message });
      this.engineState.ttsStatus = "speaking";
      try {
        const tts = await c.speak(decision.message as string);
        const source = decision.skippedLlm ? "heuristic" : decision.fallbackUsed ? "fallback" : "llm";
        this.updateLastMessage(decision.message as string, source as "llm" | "heuristic" | "fallback", (decision.llmMs as number) ?? 0, tts?.generateMs ?? 0);
        this.engineState.ttsStatus = "idle";
        this.send({ type: "tts_done", provider: tts?.provider ?? "unknown", generateMs: tts?.generateMs ?? 0 });
        await lg.log("coach_speak", { gameTime, message: decision.message, source });
        await lg.log("tts_success", { gameTime, provider: tts?.provider, message: decision.message, ttsGenerateMs: tts?.generateMs ?? 0, llmMs: decision.llmMs });
        this.log({ type: "coach_speak", gameTime, message: decision.message as string, source });
        console.log(`[Engine] [${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, "0")}] ${decision.message} [${source}]`);
      } catch (err) {
        this.engineState.ttsStatus = "error";
        await lg.log("tts_error", { gameTime, error: (err as Error).message });
        this.send({ type: "tts_error", error: (err as Error).message });
        console.error("[Engine] TTS error:", (err as Error).message);
      }
    } else {
      await lg.log("coach_silence", { gameTime, reason: decision.reason });
      this.log({ type: "coach_silence", gameTime, reason: decision.reason as string });
    }

    st.lastCoachingAt = gameTime;
  }

  private updateLastMessage(message: string, source: "llm" | "heuristic" | "fallback", llmMs: number, ttsMs: number) {
    this.engineState.lastMessage = message;
    this.engineState.lastMessageSource = source;
    this.engineState.lastLLMMs = llmMs;
    this.engineState.lastTTSMs = ttsMs;
    this.send({ type: "coaching", message, source, llmMs, ttsMs });
  }

  stop() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.running = false;
    (this as { _ticking?: boolean })._ticking = false;
    this.setStatus("idle");
    this.engineState.gameDetected = false;
    console.log("[Engine] Stopped");
  }
}

export const engine = new Engine();

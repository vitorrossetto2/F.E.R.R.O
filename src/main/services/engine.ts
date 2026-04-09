import { EventEmitter } from "events";
import type { BrowserWindow } from "electron";
import type { EngineState, EngineStatus, EngineEvent, LogEntry } from "../../shared/types";
import { populateEnvFromConfig } from "../lib/settings-bridge";
import * as configService from "./config-service";
import { CATEGORY_PRIORITIES, COOLDOWN_GROUPS } from "../../core/constants";
import { mapFerroConfigToCoreSettings } from "../../core/runtime";
import type {
  AnalyzeSnapshotResult,
  CoachDecision,
  CoreLogger,
  CoreSettings,
  GameSnapshot,
  LoopStateShape,
  MatchupTip,
  SpeakResult,
  StrategicContext,
} from "../../core/types";
import { sortTriggersByUrgency } from "../../core/analyzer";
import { emitEngineEvent, emitLogEntry } from "../ipc/shared";

const OPENING_MATCHUP_TARGET_SECONDS = 50;
const OPENING_MATCHUP_MAX_SECONDS = 120;

type LoadedCore = {
  analyzeSnapshot: (snapshot: GameSnapshot, state: LoopStateShape) => Promise<AnalyzeSnapshotResult>;
  decideCoaching: (snapshot: GameSnapshot, triggers: string[], ctx: StrategicContext, runtime?: CoreSettings) => Promise<CoachDecision>;
  detectCategory: (priority: string | null) => string;
  getCategoryCooldown: (category: string) => number;
  getMatchupTip: (snapshot: GameSnapshot, runtime?: CoreSettings) => Promise<MatchupTip | null>;
  getSnapshot: (logGame?: CoreLogger["logGame"], runtime?: CoreSettings) => Promise<GameSnapshot | null>;
  speak: (text: string, runtime?: CoreSettings) => Promise<SpeakResult>;
  createLogger: (mode?: string, runtime?: CoreSettings) => Promise<CoreLogger>;
  pickModePhrase: (key: string, mode?: string) => string;
  LoopState: new () => LoopStateShape;
};

let core: LoadedCore | null = null;

export class Engine extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private mainWindow: BrowserWindow | null = null;
  private state: LoopStateShape | null = null;
  private logger: CoreLogger | null = null;
  private runtimeSettings: CoreSettings = mapFerroConfigToCoreSettings(configService.getAll());

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
      emitEngineEvent(this.mainWindow, event);
    }
  }

  private log(entry: Partial<LogEntry> & { type: string }) {
    const full = { ts: new Date().toISOString(), sessionId: "", ...entry };
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      emitLogEntry(this.mainWindow, full);
    }
  }

  private setStatus(status: EngineStatus) {
    this.engineState.status = status;
    this.send({ type: "status_change", status });
  }

  private applyConfigToRuntime() {
    const cfg = configService.getAll();
    this.runtimeSettings = mapFerroConfigToCoreSettings(cfg);
    const llmEnabled = cfg.llm.activeProvider !== "none";

    populateEnvFromConfig();

    this.engineState.llmStatus = llmEnabled
      ? this.engineState.llmStatus === "calling"
        ? "calling"
        : "idle"
      : "disabled";
    this.engineState.piperStatus = cfg.tts.providers.piper.modelPath ? "installed" : "missing";
  }

  public getRuntimeSettings(): CoreSettings {
    return this.runtimeSettings;
  }

  public syncConfig() {
    this.applyConfigToRuntime();
    this.send({ type: "status_change", status: this.engineState.status });
  }

  private requireRuntime(): { core: LoadedCore; state: LoopStateShape; logger: CoreLogger } {
    if (!core || !this.state || !this.logger) {
      throw new Error("Engine runtime not initialized");
    }

    return { core, state: this.state, logger: this.logger };
  }

  private async loadCore() {
    if (core) return;
    this.applyConfigToRuntime();

    const [analyzerMod, coachMod, gameMod, voiceMod, loggerMod, stateMod, constantsMod] =
      await Promise.all([
        import("../../core/analyzer"),
        import("../../core/coach"),
        import("../../core/game"),
        import("../../core/voice"),
        import("../../core/logger"),
        import("../../core/state"),
        import("../../core/constants"),
      ]);

    console.log(
      "[Engine] Core loaded. logsDir:",
      this.runtimeSettings.logsDir,
      "piperExe:",
      this.runtimeSettings.piperExecutable,
      "model:",
      this.runtimeSettings.piperModelPath
    );

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
    };

    this.applyConfigToRuntime();
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log("[Engine] Starting...");

    try {
      await this.loadCore();
      const c = core;
      if (!c) throw new Error("Core failed to load");

      this.state = new c.LoopState();
      this.logger = await c.createLogger("game", this.runtimeSettings);

      this.engineState.piperStatus = this.runtimeSettings.piperModelPath ? "installed" : "missing";
      this.setStatus("waiting_for_game");

      await this.logger.log("coach_ready", { message: "Coach iniciado via Electron" });
      this.log({ type: "coach_ready", message: "Coach iniciado" });
      console.log("[Engine] Started. Polling every", this.runtimeSettings.pollIntervalSeconds, "s");

      const pollMs = this.runtimeSettings.pollIntervalSeconds * 1000;
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
    const { core: c, state: st, logger: lg } = this.requireRuntime();

    const snapshot = await c.getSnapshot((type, payload) => lg.logGame(type, payload), this.runtimeSettings);

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
      this.log({ type: "game_detected", gameTime: snapshot.gameTime, message: `Partida detectada: ${snapshot.activePlayerChampion}` });
      console.log("[Engine] Game detected:", snapshot.activePlayerChampion);
    }

    const gameTime = snapshot.gameTime;
    this.engineState.gameDetected = true;
    this.engineState.gameTime = gameTime;
    this.engineState.activeChampion = snapshot.activePlayerChampion;
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
        const greeting = c.pickModePhrase("inicioPartida", this.runtimeSettings.coachMessageMode);
        const tts = await c.speak(greeting, this.runtimeSettings);
        this.updateLastMessage(greeting, "heuristic", 0, tts.generateMs ?? 0);
        this.log({ type: "coach_speak", gameTime, message: greeting });
      } catch (err) {
        console.error("[Engine] Opening greeting error:", (err as Error).message);
      }
    }

    if (!st.matchupDone && llmEnabled && gameTime >= OPENING_MATCHUP_TARGET_SECONDS && gameTime < OPENING_MATCHUP_MAX_SECONDS) {
      st.matchupDone = true;
      try {
        const matchup = await c.getMatchupTip(snapshot, this.runtimeSettings);
        if (matchup) {
          const tts = await c.speak(matchup.message, this.runtimeSettings);
          this.updateLastMessage(matchup.message, "llm", matchup.llmMs, tts.generateMs ?? 0);
          this.log({ type: "coach_speak", gameTime, message: matchup.message });
          await lg.log("matchup_tip", { gameTime, message: matchup.message, llmMs: matchup.llmMs, llmTokens: matchup.llmTokens });
          st.lastCoachingAt = gameTime;
          console.log(`[Engine] Matchup tip: "${matchup.message}" (${matchup.llmMs}ms)`);
        } else {
          await lg.log("matchup_skip", { gameTime, reason: "getMatchupTip returned null" });
        }
      } catch (err) {
        console.error("[Engine] Matchup error:", (err as Error).message);
        await lg.log("matchup_error", { gameTime, error: (err as Error).message });
      }
    }

    // Analyze
    const { triggers: newTriggers, strategicContext } = await c.analyzeSnapshot(snapshot, st);
    const pending = st.drainPendingTriggers();
    const triggers = sortTriggersByUrgency([...new Set([...pending, ...newTriggers])]);
    const dueForCoaching = gameTime - (st.lastCoachingAt || 0) >= this.runtimeSettings.coachingIntervalSeconds;

    // Log snapshot to system log
    if (this.runtimeSettings.logSnapshots) {
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
    let decision: CoachDecision;
    try {
      if (llmEnabled) {
        this.engineState.llmStatus = "calling";
      }
      decision = await c.decideCoaching(snapshot, triggers, strategicContext, this.runtimeSettings);
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
      llmTokens: decision.llmTokens,
    });
    this.log({ type: "coach_decision", gameTime, priority: decision.priority ?? "", shouldSpeak: decision.shouldSpeak });

    if (!decision.skippedLlm) {
      if (this.runtimeSettings.logLlmPayloads) {
        await lg.log("llm_payload", {
          gameTime,
          prompt: decision.prompt,
          rawModelMessage: decision.rawModelMessage,
          llmMs: decision.llmMs,
          llmError: decision.llmError,
          llmTokens: decision.llmTokens,
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
      const category = c.detectCategory(decision.priority);

      // Check user toggle
      const msgCfg = configService.getAll().messages[category];
      if (msgCfg && !msgCfg.enabled) {
        this.log({ type: "msg_skipped", gameTime, message: `Categoria "${category}" desabilitada` });
        return;
      }

      // Category cooldown
      const cooldown = msgCfg?.cooldownSeconds ?? c.getCategoryCooldown(category);
      if (!st.canRepeatMessage(category, gameTime, cooldown)) {
        st.queueTriggers(triggers.filter((t) => c.detectCategory(t) !== category));
        return;
      }

      // Group cooldown (e.g. inimigoPerigo group)
      if (!st.canRepeatGroup(category, gameTime)) {
        this.log({ type: "msg_skipped", gameTime, message: `Grupo de "${category}" em cooldown` });
        return;
      }

      // Suppress map reminders if any message was spoken within 15s
      if (category === "mapa" && gameTime - st.lastSpeakGameTime < 15) {
        this.log({ type: "msg_skipped", gameTime, message: `Mapa suprimido: mensagem recente há ${Math.round(gameTime - st.lastSpeakGameTime)}s` });
        return;
      }

      // Global rate limiter (12s minimum between speaks)
      if (!st.canSpeakGlobal(gameTime)) {
        const prio = CATEGORY_PRIORITIES[category] ?? 0;
        if (prio >= 2 && decision.priority) {
          st.queueTriggers([decision.priority]);
        }
        this.log({ type: "msg_rate_limited", gameTime, message: `Rate limited: "${category}" (prio ${prio})` });
        return;
      }

      st.markMessageSpoken(category, gameTime);
      st.markGlobalSpeak(gameTime);

      // Mark group cooldown if applicable
      const groupName = COOLDOWN_GROUPS[category];
      if (groupName) {
        st.markGroupSpoken(groupName, gameTime);
      }

      // Speak
      this.send({ type: "tts_start", message: decision.message });
      this.engineState.ttsStatus = "speaking";
      try {
        const tts = await c.speak(decision.message, this.runtimeSettings);
        const source = decision.skippedLlm ? "heuristic" : decision.fallbackUsed ? "fallback" : "llm";
        this.updateLastMessage(decision.message, source, decision.llmMs ?? 0, tts.generateMs ?? 0);
        this.engineState.ttsStatus = "idle";
        this.send({ type: "tts_done", provider: tts.provider ?? "unknown", generateMs: tts.generateMs ?? 0 });
        await lg.log("coach_speak", { gameTime, message: decision.message, source });
        await lg.log("tts_success", { gameTime, provider: tts.provider, message: decision.message, ttsGenerateMs: tts.generateMs ?? 0, llmMs: decision.llmMs });
        this.log({ type: "coach_speak", gameTime, message: decision.message, source });
        console.log(`[Engine] [${Math.floor(gameTime / 60)}:${String(Math.floor(gameTime % 60)).padStart(2, "0")}] ${decision.message} [${source}]`);
      } catch (err) {
        this.engineState.ttsStatus = "error";
        await lg.log("tts_error", { gameTime, error: (err as Error).message });
        this.send({ type: "tts_error", error: (err as Error).message });
        console.error("[Engine] TTS error:", (err as Error).message);
      }
    } else {
      await lg.log("coach_silence", { gameTime, reason: decision.reason });
      this.log({ type: "coach_silence", gameTime, reason: decision.reason });
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

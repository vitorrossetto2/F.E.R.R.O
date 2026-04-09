// ── Engine ──────────────────────────────────────────────

export type EngineStatus =
  | "idle"
  | "waiting_for_game"
  | "coaching"
  | "paused"
  | "error";

export interface EngineState {
  status: EngineStatus;
  gameDetected: boolean;
  gameTime: number;
  activeChampion: string;
  lastMessage: string;
  lastMessageSource: "llm" | "heuristic" | "fallback" | "";
  lastLLMMs: number;
  lastTTSMs: number;
  ttsStatus: "idle" | "speaking" | "error";
  llmStatus: "idle" | "calling" | "error" | "disabled";
  piperStatus: "installed" | "missing" | "error";
  errorMessage: string | null;
}

export type EngineEventType =
  | "status_change"
  | "game_detected"
  | "game_ended"
  | "coaching"
  | "silence"
  | "tts_start"
  | "tts_done"
  | "tts_error"
  | "llm_call"
  | "llm_response"
  | "llm_error"
  | "error";

export interface EngineStatusChangeEvent {
  type: "status_change";
  status: EngineStatus;
}

export interface EngineGameDetectedEvent {
  type: "game_detected";
  champion: string;
  gameTime: number;
}

export interface EngineGameEndedEvent {
  type: "game_ended";
}

export interface EngineCoachingEvent {
  type: "coaching";
  message: string;
  source: "llm" | "heuristic" | "fallback";
  llmMs: number;
  ttsMs: number;
}

export interface EngineSilenceEvent {
  type: "silence";
  gameTime: number;
  reason: string;
}

export interface EngineTtsStartEvent {
  type: "tts_start";
  message: string;
}

export interface EngineTtsDoneEvent {
  type: "tts_done";
  provider: string;
  generateMs: number;
}

export interface EngineTtsErrorEvent {
  type: "tts_error";
  error: string;
}

export interface EngineLlmResponseEvent {
  type: "llm_response";
  gameTime: number;
  llmMs: number;
  fallbackUsed: boolean;
  rawModelMessage: string | null | undefined;
}

export interface EngineLlmErrorEvent {
  type: "llm_error";
  gameTime: number;
  error: string;
  llmMs: number;
}

export interface EngineErrorEvent {
  type: "error";
  message: string;
}

export type EngineEvent =
  | EngineStatusChangeEvent
  | EngineGameDetectedEvent
  | EngineGameEndedEvent
  | EngineCoachingEvent
  | EngineSilenceEvent
  | EngineTtsStartEvent
  | EngineTtsDoneEvent
  | EngineTtsErrorEvent
  | EngineLlmResponseEvent
  | EngineLlmErrorEvent
  | EngineErrorEvent;

export interface ConfigChangedPayload {
  path: string;
  value: unknown;
}

// ── Config ─────────────────────────────────────────────

export type LLMProviderType = "none" | "zai" | "openai" | "gemini";
export type TTSProviderType = "piper" | "elevenlabs" | "system";
export type MessageMode = "serio" | "meme" | "puto";

export interface LLMProviderConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export interface MessageCategoryConfig {
  enabled: boolean;
  cooldownSeconds: number;
}

export interface FerroConfig {
  llm: {
    activeProvider: LLMProviderType;
    providers: {
      zai: LLMProviderConfig;
      openai: LLMProviderConfig;
      gemini: LLMProviderConfig;
    };
  };
  tts: {
    activeProvider: TTSProviderType;
    volume: number;
    providers: {
      piper: {
        executablePath: string;
        modelPath: string;
        speaker: number;
      };
      elevenlabs: {
        apiKey: string;
        voiceId: string;
      };
      system: {
        voice: string;
      };
    };
  };
  coach: {
    messageMode: MessageMode;
  };
  game: {
    pollIntervalSeconds: number;
    coachingIntervalSeconds: number;
    mapReminderIntervalSeconds: number;
    stalledGoldThreshold: number;
  };
  objectives: {
    dragonFirstSpawn: number;
    dragonRespawn: number;
    grubsFirstSpawn: number;
    grubsDespawn: number;
    heraldFirstSpawn: number;
    heraldDespawn: number;
    baronFirstSpawn: number;
    baronRespawn: number;
    oneMinuteCall: number;
    thirtySecondsCall: number;
    tenSecondsCall: number;
  };
  messages: Record<string, MessageCategoryConfig>;
  logging: {
    logsDir: string;
    logSnapshots: boolean;
    logLlmPayloads: boolean;
  };
  app: {
    onboardingCompleted: boolean;
    windowBounds: { x: number; y: number; width: number; height: number } | null;
  };
}

export interface StartupState {
  onboardingCompleted: boolean;
  needsOnboarding: boolean;
  piperBinaryInstalled: boolean;
  piperModelConfigured: boolean;
  piperModelExists: boolean;
  activeTtsProvider: TTSProviderType;
  engineAutoStartAllowed: boolean;
}

// ── Voice / Model selectors ────────────────────────────

export interface VoiceOption {
  id: string;
  name: string;
  description?: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

// ── Logs ───────────────────────────────────────────────

export interface LogEntry {
  ts: string;
  sessionId: string;
  type: string;
  gameTime?: number;
  [key: string]: unknown;
}

export interface ElevenLabsUsageSummary {
  sessionId: string;
  ttsCount: number;
  totalChars: number;
  estimatedCredits: number;
  averageCharsPerMessage: number;
  durationSeconds: number;
  costBRL: number;
}

// ── Match Analysis ─────────────────────────────────────

export interface SessionSummary {
  sessionId: string;
  filename: string;
  startTime: string;
  sizeBytes: number;
}

// ── Piper ──────────────────────────────────────────────

export interface PiperVoiceOption {
  id: string;
  name: string;
  file: string;
  desc: string;
  size: string;
}

export interface PiperStatus {
  installed: boolean;
  path?: string;
}

export interface PiperProgress {
  stage: "downloading_binary" | "extracting" | "downloading_voice" | "verifying" | "done" | "error";
  percent: number;
  message: string;
}

export type TtsTestResult =
  | { ok: true; provider?: string; generateMs?: number }
  | { ok: false; error: string };

export type LlmTestResult =
  | { ok: true; response: string; ms: number }
  | { ok: false; error: string };

export type LlmCoachingTestResult =
  | { ok: true; message: string; llmMs: number }
  | { ok: false; error: string };

export type PiperInstallResult =
  | { ok: true }
  | { ok: false; error: string };

export interface FerroAPI {
  getConfig(): Promise<FerroConfig>;
  setConfig(path: string, value: unknown): Promise<void>;
  resetConfig(): Promise<void>;
  onConfigChanged(cb: (payload: ConfigChangedPayload) => void): () => void;

  startEngine(): Promise<void>;
  stopEngine(): Promise<void>;
  getEngineStatus(): Promise<EngineState>;
  onEngineEvent(cb: (event: EngineEvent) => void): () => void;

  getLogs(count: number): Promise<LogEntry[]>;
  getElevenLabsUsageSummary(): Promise<ElevenLabsUsageSummary | null>;
  onLogEntry(cb: (entry: LogEntry) => void): () => void;
  clearLogs(): Promise<void>;

  listSessions(): Promise<unknown[]>;
  getSession(sessionId: string): Promise<unknown>;
  getLastMatch(): Promise<unknown | null>;

  listPiperVoices(): Promise<PiperVoiceOption[]>;
  listElevenLabsVoices(apiKey: string): Promise<VoiceOption[]>;
  listSystemVoices(): Promise<VoiceOption[]>;

  testTTS(provider: string, text: string): Promise<TtsTestResult>;
  testLLM(provider: string): Promise<LlmTestResult>;
  testLLMCoaching(): Promise<LlmCoachingTestResult>;

  getAvailablePiperVoices(): Promise<PiperVoiceOption[]>;
  installPiper(voiceId: string): Promise<PiperInstallResult>;
  onPiperProgress(cb: (progress: PiperProgress) => void): () => void;

  selectDirectory(): Promise<string | null>;
  getAppVersion(): Promise<string>;
  getStartupState(): Promise<StartupState>;
  completeOnboarding(): Promise<void>;
}

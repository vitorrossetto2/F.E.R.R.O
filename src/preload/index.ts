import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/channels";
import type {
  ConfigChangedPayload,
  EngineEvent,
  FerroAPI,
  LlmCoachingTestResult,
  LlmTestResult,
  LogEntry,
  PiperInstallResult,
  PiperProgress,
  PiperVoiceOption,
  StartupState,
  TtsTestResult,
  VoiceOption,
  ElevenLabsUsageSummary,
  EngineState,
  FerroConfig,
} from "../shared/types";

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function sub<T>(channel: string, cb: (payload: T) => void) {
  const handler = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: FerroAPI = {
  // Config
  getConfig: () => invoke<FerroConfig>(IPC.CONFIG_GET),
  setConfig: (path: string, value: unknown) => invoke<void>(IPC.CONFIG_SET, path, value),
  resetConfig: () => invoke<void>(IPC.CONFIG_RESET),
  onConfigChanged: (cb: (data: ConfigChangedPayload) => void) => sub<ConfigChangedPayload>(IPC.CONFIG_CHANGED, cb),

  // Engine
  startEngine: () => invoke<void>(IPC.ENGINE_START),
  stopEngine: () => invoke<void>(IPC.ENGINE_STOP),
  getEngineStatus: () => invoke<EngineState>(IPC.ENGINE_STATUS),
  onEngineEvent: (cb: (data: EngineEvent) => void) => sub<EngineEvent>(IPC.ENGINE_EVENT, cb),

  // Logs
  getLogs: (count: number) => invoke<LogEntry[]>(IPC.LOGS_GET, count),
  getElevenLabsUsageSummary: () => invoke<ElevenLabsUsageSummary | null>(IPC.ELEVENLABS_USAGE_GET),
  onLogEntry: (cb: (entry: LogEntry) => void) => sub<LogEntry>(IPC.LOGS_ENTRY, cb),
  clearLogs: () => invoke<void>(IPC.LOGS_CLEAR),

  // Match
  getLastMatch: () => invoke<unknown | null>(IPC.MATCH_LAST),

  // Voice listing
  listPiperVoices: () => invoke<PiperVoiceOption[]>(IPC.VOICES_LIST_PIPER),
  listElevenLabsVoices: (apiKey: string) => invoke<VoiceOption[]>(IPC.VOICES_LIST_ELEVENLABS, apiKey),
  listSystemVoices: () => invoke<VoiceOption[]>(IPC.VOICES_LIST_SYSTEM),

  // TTS / LLM
  testTTS: (provider: string, text: string) => invoke<TtsTestResult>(IPC.TTS_TEST, provider, text),
  testLLM: (provider: string) => invoke<LlmTestResult>(IPC.LLM_TEST, provider),
  testLLMCoaching: () => invoke<LlmCoachingTestResult>(IPC.LLM_TEST_COACHING),

  // Piper
  getAvailablePiperVoices: () => invoke<PiperVoiceOption[]>(IPC.PIPER_AVAILABLE_VOICES),
  installPiper: (voiceId: string) => invoke<PiperInstallResult>(IPC.PIPER_INSTALL, voiceId),
  onPiperProgress: (cb: (data: PiperProgress) => void) => sub<PiperProgress>(IPC.PIPER_PROGRESS, cb),

  // System
  selectDirectory: () => invoke<string | null>(IPC.DIALOG_SELECT_DIR),
  getAppVersion: () => invoke<string>(IPC.APP_VERSION),
  getStartupState: () => invoke<StartupState>(IPC.APP_GET_STARTUP_STATE),
  completeOnboarding: () => invoke<void>(IPC.APP_COMPLETE_ONBOARDING),
};

contextBridge.exposeInMainWorld("ferroAPI", api);

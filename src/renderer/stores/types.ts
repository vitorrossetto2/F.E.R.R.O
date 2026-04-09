import type {
  EngineState,
  ElevenLabsUsageSummary,
  FerroConfig,
  LogEntry,
  StartupState,
} from "../../shared/types";

export type RendererConfigState = {
  config: FerroConfig | null;
  loading: boolean;
  error: string | null;
};

export type RendererEngineState = {
  engine: EngineState;
  loading: boolean;
  error: string | null;
};

export type RendererStartupState = {
  startupState: StartupState | null;
  loading: boolean;
  error: string | null;
};

export type RendererLogsState = {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
};

export type RendererUsageState = {
  summary: ElevenLabsUsageSummary | null;
  loading: boolean;
  error: string | null;
};

import { create } from "zustand";
import type { EngineState } from "../../shared/types";
import type { RendererEngineState } from "./types";
import { getErrorMessage } from "./utils";

const DEFAULT_ENGINE_STATE: EngineState = {
  status: "idle",
  gameDetected: false,
  gameTime: 0,
  activeChampion: "",
  lastMessage: "",
  lastMessageSource: "",
  lastLLMMs: 0,
  lastTTSMs: 0,
  ttsStatus: "idle",
  llmStatus: "idle",
  piperStatus: "missing",
  errorMessage: null,
};

type EngineStore = RendererEngineState & {
  hydrated: boolean;
  refresh: () => Promise<EngineState | null>;
  start: () => Promise<EngineState | null>;
  stop: () => Promise<EngineState | null>;
};

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: DEFAULT_ENGINE_STATE,
  loading: true,
  error: null,
  hydrated: false,
  refresh: async () => {
    if (!get().hydrated) {
      set({ loading: true, error: null });
    } else {
      set({ error: null });
    }
    try {
      const engine = await window.ferroAPI.getEngineStatus();
      set({ engine, loading: false, error: null, hydrated: true });
      return engine;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
  start: async () => {
    set({ loading: true, error: null });
    try {
      await window.ferroAPI.startEngine();
      const engine = await window.ferroAPI.getEngineStatus();
      set({ engine, loading: false, error: null, hydrated: true });
      return engine;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
  stop: async () => {
    set({ loading: true, error: null });
    try {
      await window.ferroAPI.stopEngine();
      const engine = await window.ferroAPI.getEngineStatus();
      set({ engine, loading: false, error: null, hydrated: true });
      return engine;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
}));

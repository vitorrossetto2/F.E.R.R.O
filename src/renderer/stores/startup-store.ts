import { create } from "zustand";
import type { StartupState } from "../../shared/types";
import type { RendererStartupState } from "./types";
import { getErrorMessage } from "./utils";

type StartupStore = RendererStartupState & {
  hydrated: boolean;
  refresh: () => Promise<StartupState | null>;
};

export const useStartupStateStore = create<StartupStore>((set, get) => ({
  startupState: null,
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
      const startupState = (await window.ferroAPI.getStartupState()) as StartupState;
      set({ startupState, loading: false, error: null, hydrated: true });
      return startupState;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
}));

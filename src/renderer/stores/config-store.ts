import { create } from "zustand";
import type { FerroConfig } from "../../shared/types";
import type { RendererConfigState } from "./types";
import { getErrorMessage } from "./utils";

type ConfigStore = RendererConfigState & {
  hydrated: boolean;
  refresh: () => Promise<FerroConfig | null>;
  update: (path: string, value: unknown) => Promise<FerroConfig | null>;
  reset: () => Promise<FerroConfig | null>;
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
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
      const config = await window.ferroAPI.getConfig();
      set({ config, loading: false, error: null, hydrated: true });
      return config;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
  update: async (path: string, value: unknown) => {
    set({ error: null });
    try {
      await window.ferroAPI.setConfig(path, value);
      const config = await window.ferroAPI.getConfig();
      set({ config, loading: false, error: null, hydrated: true });
      return config;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
  reset: async () => {
    set({ error: null });
    try {
      await window.ferroAPI.resetConfig();
      const config = await window.ferroAPI.getConfig();
      set({ config, loading: false, error: null, hydrated: true });
      return config;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
}));

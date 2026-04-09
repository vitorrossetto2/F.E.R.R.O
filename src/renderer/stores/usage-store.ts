import { create } from "zustand";
import type { ElevenLabsUsageSummary } from "../../shared/types";
import type { RendererUsageState } from "./types";
import { getErrorMessage } from "./utils";

type UsageStore = RendererUsageState & {
  hydrated: boolean;
  refresh: () => Promise<ElevenLabsUsageSummary | null>;
};

export const useElevenLabsUsageSummaryStore = create<UsageStore>((set, get) => ({
  summary: null,
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
      const summary = await window.ferroAPI.getElevenLabsUsageSummary();
      set({ summary: summary ?? null, loading: false, error: null, hydrated: true });
      return summary ?? null;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return null;
    }
  },
}));

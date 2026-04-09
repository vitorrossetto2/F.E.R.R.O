import { create } from "zustand";
import type { LogEntry } from "../../shared/types";
import type { RendererLogsState } from "./types";
import { getErrorMessage } from "./utils";

const MAX_LOGS = 300;

type LogsStore = RendererLogsState & {
  hydrated: boolean;
  refresh: () => Promise<LogEntry[]>;
  append: (entry: LogEntry) => void;
  clear: () => Promise<void>;
};

export const useLogsStore = create<LogsStore>((set, get) => ({
  logs: [],
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
      const logs = (await window.ferroAPI.getLogs(MAX_LOGS)) as LogEntry[];
      set({ logs, loading: false, error: null, hydrated: true });
      return logs;
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
      return [];
    }
  },
  append: (entry: LogEntry) => {
    set((state) => {
      const next = [...state.logs, entry];
      return { logs: next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next };
    });
  },
  clear: async () => {
    set({ error: null });
    try {
      await window.ferroAPI.clearLogs();
      set({ logs: [], loading: false, error: null, hydrated: true });
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error), hydrated: true });
    }
  },
}));

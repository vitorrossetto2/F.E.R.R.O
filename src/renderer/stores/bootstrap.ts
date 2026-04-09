import type { LogEntry } from "../../shared/types";
import { useConfigStore } from "./config-store";
import { useElevenLabsUsageSummaryStore } from "./usage-store";
import { useEngineStore } from "./engine-store";
import { useLogsStore } from "./logs-store";
import { useStartupStateStore } from "./startup-store";

let bootstrapped = false;
let disposeFns: Array<() => void> = [];

export function bootstrapRendererState() {
  if (!bootstrapped) {
    bootstrapped = true;

    void Promise.all([
      useConfigStore.getState().refresh(),
      useEngineStore.getState().refresh(),
      useStartupStateStore.getState().refresh(),
      useLogsStore.getState().refresh(),
      useElevenLabsUsageSummaryStore.getState().refresh(),
    ]);

    disposeFns = [
      window.ferroAPI.onConfigChanged(() => {
        void Promise.all([
          useConfigStore.getState().refresh(),
          useEngineStore.getState().refresh(),
          useStartupStateStore.getState().refresh(),
          useElevenLabsUsageSummaryStore.getState().refresh(),
        ]);
      }),
      window.ferroAPI.onEngineEvent(() => {
        void useEngineStore.getState().refresh();
      }),
      window.ferroAPI.onLogEntry((entry: unknown) => {
        useLogsStore.getState().append(entry as LogEntry);
      }),
    ];
  }

  return cleanupRendererState;
}

export function cleanupRendererState() {
  for (const dispose of disposeFns) {
    dispose();
  }
  disposeFns = [];
  bootstrapped = false;
}

import { ipcMain } from "electron";
import path from "path";
import { IPC } from "../../shared/channels";
import * as configService from "../services/config-service";
import { log } from "./shared";

const TAG = "[IPC]";

export function registerMatchHandlers(): void {
  ipcMain.handle(IPC.MATCH_LIST, () => []);
  ipcMain.handle(IPC.MATCH_GET, () => null);

  ipcMain.handle(IPC.MATCH_LAST, async () => {
    try {
      const config = configService.getAll();
      const gameDir = path.join(config.logging.logsDir, "game");
      log("match:last loading from", gameDir);
      const mod = await import("../../core/match-analyzer");
      const sessions = await mod.listSessionSummaries(gameDir);
      if (!sessions || sessions.length === 0) {
        log("match:last no sessions found");
        return null;
      }
      const last = sessions[0];
      log("match:last analyzing session", last.sessionId);
      const analysis = await mod.getSessionAnalysis(gameDir, last.sessionId);
      return analysis;
    } catch (error) {
      console.error(TAG, "match:last error:", (error as Error).message);
      return null;
    }
  });
}

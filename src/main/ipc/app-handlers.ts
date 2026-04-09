import { app, dialog, ipcMain } from "electron";
import { IPC } from "../../shared/channels";
import * as configService from "../services/config-service";
import { getLatestElevenLabsUsageSummary } from "../services/elevenlabs-usage-service";
import { getStartupState } from "../services/startup-state";
import { clearLogEntries, emitConfigChanged, getRecentLogEntries, log, type IpcHandlerContext } from "./shared";

const TAG = "[IPC]";

export function registerAppHandlers({ mainWindow }: IpcHandlerContext): void {
  ipcMain.handle(IPC.LOGS_GET, (_event, count: number) => getRecentLogEntries(count));

  ipcMain.handle(IPC.ELEVENLABS_USAGE_GET, async () => {
    try {
      const config = configService.getAll();
      return await getLatestElevenLabsUsageSummary(config.logging.logsDir);
    } catch (error) {
      console.error(TAG, "elevenlabs:usage:get error:", (error as Error).message);
      return null;
    }
  });

  ipcMain.handle(IPC.LOGS_CLEAR, () => {
    clearLogEntries();
  });

  ipcMain.handle(IPC.DIALOG_SELECT_DIR, async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion());

  ipcMain.handle(IPC.APP_GET_STARTUP_STATE, () => {
    const startup = getStartupState();
    log("app:getStartupState", startup);
    return startup;
  });

  ipcMain.handle(IPC.APP_COMPLETE_ONBOARDING, () => {
    log("app:completeOnboarding");
    configService.setPath("app.onboardingCompleted", true);
    emitConfigChanged(mainWindow, { path: "app.onboardingCompleted", value: true });
  });
}

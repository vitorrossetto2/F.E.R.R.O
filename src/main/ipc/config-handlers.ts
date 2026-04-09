import { ipcMain } from "electron";
import { IPC } from "../../shared/channels";
import * as configService from "../services/config-service";
import { engine } from "../services/engine";
import { emitConfigChanged, log, type IpcHandlerContext } from "./shared";

export function registerConfigHandlers({ mainWindow }: IpcHandlerContext): void {
  ipcMain.handle(IPC.CONFIG_GET, () => {
    return configService.getAll();
  });

  ipcMain.handle(IPC.CONFIG_SET, (_event, configPath: string, value: unknown) => {
    log("config:set", configPath, typeof value === "string" && value.length > 20 ? value.slice(0, 20) + "..." : value);
    configService.setPath(configPath, value);
    engine.syncConfig();
    emitConfigChanged(mainWindow, { path: configPath, value });
  });

  ipcMain.handle(IPC.CONFIG_RESET, () => {
    log("config:reset");
    configService.reset();
    engine.syncConfig();
    emitConfigChanged(mainWindow, { path: "config", value: null });
  });
}

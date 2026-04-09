import { ipcMain } from "electron";
import { IPC } from "../../shared/channels";
import { engine } from "../services/engine";
import { log } from "./shared";

export function registerEngineHandlers(): void {
  ipcMain.handle(IPC.ENGINE_START, async () => {
    log("engine:start");
    await engine.start();
  });

  ipcMain.handle(IPC.ENGINE_STOP, () => {
    log("engine:stop");
    engine.stop();
  });

  ipcMain.handle(IPC.ENGINE_STATUS, () => engine.engineState);
}

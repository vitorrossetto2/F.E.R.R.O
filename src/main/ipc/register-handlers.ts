import type { BrowserWindow } from "electron";
import { registerAppHandlers } from "./app-handlers";
import { registerConfigHandlers } from "./config-handlers";
import { registerEngineHandlers } from "./engine-handlers";
import { registerMatchHandlers } from "./match-handlers";
import { log } from "./shared";
import { registerVoiceHandlers } from "./voice-handlers";

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const context = { mainWindow };

  registerConfigHandlers(context);
  registerEngineHandlers();
  registerVoiceHandlers(context);
  registerMatchHandlers();
  registerAppHandlers(context);

  log("All IPC handlers registered");
}

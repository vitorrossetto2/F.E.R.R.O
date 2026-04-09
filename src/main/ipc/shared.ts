import type { BrowserWindow } from "electron";
import { IPC } from "../../shared/channels";
import type { ConfigChangedPayload, EngineEvent, LogEntry, PiperProgress } from "../../shared/types";

const TAG = "[IPC]";

export function log(...args: unknown[]) {
  console.log(TAG, ...args);
}

export function safeAsciiPreview(text: string, maxLen = 30): string {
  // Keep log output stable on Windows terminals with non-UTF8 code pages.
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
  return normalized.length > maxLen ? normalized.slice(0, maxLen) + "..." : normalized;
}

export function keyFingerprint(apiKey: string): string {
  const clean = apiKey.trim();
  if (!clean) return "none";
  if (clean.length <= 8) return `${clean.slice(0, 2)}...(${clean.length})`;
  return `${clean.slice(0, 4)}...${clean.slice(-4)} (${clean.length})`;
}

export function normalizeTtsProvider(provider: string): "piper" | "elevenlabs" | "say" {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "piper") return "piper";
  if (normalized === "elevenlabs") return "elevenlabs";
  return "say";
}

export function emitConfigChanged(mainWindow: BrowserWindow, payload: ConfigChangedPayload): void {
  mainWindow.webContents.send(IPC.CONFIG_CHANGED, payload);
}

export function emitEngineEvent(mainWindow: BrowserWindow, event: EngineEvent): void {
  mainWindow.webContents.send(IPC.ENGINE_EVENT, event);
}

export function emitLogEntry(mainWindow: BrowserWindow, entry: LogEntry): void {
  mainWindow.webContents.send(IPC.LOGS_ENTRY, entry);
}

export function emitPiperProgress(mainWindow: BrowserWindow, progress: PiperProgress): void {
  mainWindow.webContents.send(IPC.PIPER_PROGRESS, progress);
}

export type IpcHandlerContext = {
  mainWindow: BrowserWindow;
};

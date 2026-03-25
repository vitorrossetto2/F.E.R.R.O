import { existsSync, createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import type { BrowserWindow } from "electron";
import { IPC } from "../../shared/channels.js";
import type { PiperVoiceOption, PiperStatus } from "../../shared/types.js";

const MICAAI_DIR = path.join(os.homedir(), ".micaai");
const PIPER_DIR = path.join(MICAAI_DIR, "piper");
const VOICES_DIR = path.join(MICAAI_DIR, "voices");
const PIPER_EXE = path.join(PIPER_DIR, "piper.exe");

const PIPER_BINARY_URL =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";

const VOICE_BASE_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR";

export const PIPER_VOICES: PiperVoiceOption[] = [
  { id: "faber-medium", name: "Faber (Medium)", file: "pt_BR-faber-medium", desc: "Recomendada", size: "63MB" },
  { id: "cadu-medium", name: "Cadu (Medium)", file: "pt_BR-cadu-medium", desc: "", size: "63MB" },
  { id: "jeff-medium", name: "Jeff (Medium)", file: "pt_BR-jeff-medium", desc: "", size: "63MB" },
  { id: "edresson-low", name: "Edresson (Low)", file: "pt_BR-edresson-low", desc: "", size: "63MB" },
];

function voiceUrl(voice: PiperVoiceOption): { onnx: string; json: string } {
  // e.g. faber-medium → faber/medium
  const parts = voice.id.split("-");
  const name = parts[0];
  const quality = parts[1];
  return {
    onnx: `${VOICE_BASE_URL}/${name}/${quality}/${voice.file}.onnx`,
    json: `${VOICE_BASE_URL}/${name}/${quality}/${voice.file}.onnx.json`,
  };
}

export function checkPiper(): PiperStatus {
  const installed = existsSync(PIPER_EXE);
  return { installed, path: installed ? PIPER_EXE : undefined };
}

export function getPiperDir() {
  return PIPER_DIR;
}

export function getVoicesDir() {
  return VOICES_DIR;
}

function downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string) => {
      const client = currentUrl.startsWith("https") ? https : http;
      client.get(currentUrl, { headers: { "User-Agent": "MicaAI/1.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const location = res.headers.location;
          const resolved = location.startsWith("http") ? location : new URL(location, currentUrl).href;
          follow(resolved);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} downloading ${currentUrl}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = createWriteStream(destPath);

        res.on("data", (chunk: Buffer) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (totalBytes > 0 && onProgress) {
            onProgress(Math.round((downloaded / totalBytes) * 100));
          }
        });

        res.on("end", () => {
          file.end(() => resolve());
        });

        res.on("error", (err) => {
          file.close();
          reject(err);
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

export async function installPiper(
  voiceId: string,
  mainWindow: BrowserWindow
): Promise<{ ok: boolean; error?: string }> {
  const voice = PIPER_VOICES.find((v) => v.id === voiceId);
  if (!voice) return { ok: false, error: `Voz não encontrada: ${voiceId}` };

  const send = (stage: string, percent: number, message: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.PIPER_PROGRESS, { stage, percent, message });
    }
  };

  try {
    await mkdir(PIPER_DIR, { recursive: true });
    await mkdir(VOICES_DIR, { recursive: true });

    // Step 1: Download piper binary zip
    if (!existsSync(PIPER_EXE)) {
      const zipPath = path.join(MICAAI_DIR, "piper.zip");
      send("downloading_binary", 0, "Baixando Piper...");

      await downloadFile(PIPER_BINARY_URL, zipPath, (p) => {
        send("downloading_binary", p, `Baixando Piper... ${p}%`);
      });

      // Step 2: Extract zip — the zip contains a nested piper/ folder,
      // so we extract to MICAAI_DIR which creates MICAAI_DIR/piper/
      send("extracting", 0, "Extraindo Piper...");
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(MICAAI_DIR, true);
      send("extracting", 100, "Piper extraído");

      await unlink(zipPath).catch(() => {});
    }

    // Step 3: Download voice model
    const urls = voiceUrl(voice);
    const onnxPath = path.join(VOICES_DIR, `${voice.file}.onnx`);
    const jsonPath = path.join(VOICES_DIR, `${voice.file}.onnx.json`);

    if (!existsSync(onnxPath)) {
      send("downloading_voice", 0, `Baixando voz ${voice.name}...`);
      await downloadFile(urls.onnx, onnxPath, (p) => {
        send("downloading_voice", p, `Baixando voz ${voice.name}... ${p}%`);
      });
    }

    if (!existsSync(jsonPath)) {
      await downloadFile(urls.json, jsonPath);
    }

    // Step 4: Verify
    send("verifying", 50, "Verificando instalação...");
    if (!existsSync(PIPER_EXE)) {
      send("error", 0, "piper.exe não encontrado após extração");
      return { ok: false, error: "piper.exe não encontrado após extração" };
    }

    send("done", 100, "Piper instalado com sucesso!");
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    send("error", 0, msg);
    return { ok: false, error: msg };
  }
}

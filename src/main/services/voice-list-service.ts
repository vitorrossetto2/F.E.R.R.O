import { readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import https from "https";
import { exec } from "child_process";
import { getVoicesDir } from "./piper-installer.js";
import type { VoiceOption } from "../../shared/types.js";

export async function listPiperVoices(): Promise<VoiceOption[]> {
  const dir = getVoicesDir();
  if (!existsSync(dir)) return [];

  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".onnx"))
      .map((f) => {
        const name = f.replace(".onnx", "").replace(/pt_BR-/g, "").replace(/-/g, " ");
        return { id: path.join(dir, f), name };
      });
  } catch {
    return [];
  }
}

export async function listElevenLabsVoices(apiKey: string): Promise<VoiceOption[]> {
  if (!apiKey) return [];

  return new Promise((resolve) => {
    const req = https.get(
      "https://api.elevenlabs.io/v1/voices",
      { headers: { "xi-api-key": apiKey, Accept: "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const voices = (json.voices || []).map((v: { voice_id: string; name: string }) => ({
              id: v.voice_id,
              name: v.name,
            }));
            resolve(voices);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on("error", () => resolve([]));
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
  });
}

export function listSystemVoices(): Promise<VoiceOption[]> {
  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }"`;

    exec(cmd, { timeout: 10000 }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      const voices = stdout
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((name) => ({ id: name, name }));
      resolve(voices);
    });
  });
}

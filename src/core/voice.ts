import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile, unlink, writeFile } from "node:fs/promises";
import https from "node:https";

import say from "say";

import { settings } from "./config";
import type { SpeakResult } from "./types";

const PHONETIC_MAP: Array<[RegExp, string]> = [
  [/\bmid\b/gi, "mídi"],
  [/\bbuild\b/gi, "bíudi"],
  [/\bbuilds\b/gi, "bíudis"],
  [/\bpowerspike\b/gi, "páuer espáique"],
  [/\bpowerspikes\b/gi, "páuer espáiques"],
  [/\bside\b/gi, "sáide"],
  [/\bsidelane\b/gi, "sáide lêine"],
  [/\btop\b/gi, "tópi"],
  [/\bbot\b/gi, "bóti"],
  [/\bjungle\b/gi, "djângou"],
  [/\bjungler\b/gi, "djânglêr"],
  [/\bgank\b/gi, "guénqui"],
  [/\bganks\b/gi, "guénquis"],
  [/\bsplit\b/gi, "esplíti"],
  [/\bpush\b/gi, "púchi"],
  [/\bpushar\b/gi, "puchar"],
  [/\bresetar\b/gi, "rêssetar"],
  [/\breset\b/gi, "rêsseti"],
  [/\bfeed\b/gi, "fídi"],
  [/\bfed\b/gi, "fédi"],
  [/\bfreeze\b/gi, "frízi"],
  [/\broam\b/gi, "rôumi"],
  [/\broaming\b/gi, "rôumingui"],
  [/\bback\b/gi, "béqui"],
  [/\blate game\b/gi, "lêiti guêimi"],
  [/\bearly game\b/gi, "érli guêimi"],
  [/\bkill\b/gi, "kíu"],
  [/\bkills\b/gi, "kíus"],
  [/\bshutdown\b/gi, "chatidáuni"],
  [/\bwave\b/gi, "uêivi"],
  [/\bsetup\b/gi, "setápi"],
  [/\bteamfight\b/gi, "tímifáiti"],
  [/\bflash\b/gi, "fléchi"],
  [/\bpoke\b/gi, "pôuqui"],
  [/\bengage\b/gi, "inguêidji"],
  [/\bdisengage\b/gi, "disinguêidji"],
  [/\bstall\b/gi, "estóu"],
];

export function toPhonetic(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PHONETIC_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function runProcess(command: string, args: string[], inputText = ""): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Set cwd to the directory of the command so DLLs are found
    const cwd = path.dirname(command);
    const spawnOpts: { stdio: ["pipe", "ignore", "pipe"]; cwd?: string } = { stdio: ["pipe", "ignore", "pipe"] };
    if (cwd && cwd !== ".") spawnOpts.cwd = cwd;
    const child = spawn(command, args, spawnOpts);

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} saiu com codigo ${code}`));
    });

    child.stdin.write(inputText);
    child.stdin.end();
  });
}

let playbackPromise = Promise.resolve();

function playWavFileAsync(filePath: string): void {
  const escapedPath = filePath.replace(/'/g, "''");

  playbackPromise = playbackPromise.then(() => new Promise<void>((resolve) => {
    const child = spawn("powershell", [
      "-NoProfile",
      "-Command",
      `(New-Object System.Media.SoundPlayer '${escapedPath}').PlaySync()`
    ], { stdio: "ignore" });

    child.on("close", () => {
      unlink(filePath).catch(() => {});
      resolve();
    });
    child.on("error", () => {
      unlink(filePath).catch(() => {});
      resolve();
    });
  }));
}

async function speakWithPiper(text: string): Promise<SpeakResult> {
  if (!settings.piperModelPath) {
    throw new Error("PIPER_MODEL_PATH nao configurado.");
  }

  const tempFile = path.join(tmpdir(), `lol-coach-${Date.now()}.wav`);
  const args = [
    "--model",
    settings.piperModelPath,
    "--output_file",
    tempFile
  ];

  if (settings.piperSpeaker >= 0) {
    args.push("--speaker", String(settings.piperSpeaker));
  }

  const generateStart = performance.now();
  await runProcess(settings.piperExecutable, args, text);
  const generateMs = Math.round(performance.now() - generateStart);

  if (settings.ttsVolume < 0.99) {
    const wavData = await readFile(tempFile);
    const scaled = scaleWavVolume(wavData, settings.ttsVolume);
    await writeFile(tempFile, scaled);
  }

  playWavFileAsync(tempFile);

  return { generateMs, playMs: 0, provider: "piper" };
}

function speakWithSay(text: string): SpeakResult {
  say.speak(text, settings.ttsVoice, 1.0, (error: string | null) => {
    if (error) {
      console.error("[TTS say] erro:", error);
    }
  });
  return { generateMs: 0, playMs: 0, provider: "say" };
}

function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate = 16000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function elevenLabsSynthesizePcm(text: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    if (!settings.elevenlabsApiKey) {
      reject(new Error("ELEVENLABS_API_KEY nao configurada."));
      return;
    }
    if (!settings.elevenlabsVoiceId) {
      reject(new Error("ELEVENLABS_VOICE_ID nao configurada."));
      return;
    }

    const body = JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    });

    const requestUrl = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.elevenlabsVoiceId)}`);
    requestUrl.searchParams.set("output_format", "pcm_16000");

    const req = https.request(
      requestUrl,
      {
        method: "POST",
        headers: {
          "xi-api-key": settings.elevenlabsApiKey,
          Accept: "application/octet-stream",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const out = Buffer.concat(chunks);
          if ((res.statusCode ?? 500) >= 400) {
            const body = out.toString("utf8").trim();
            const message = body
              ? `ElevenLabs HTTP ${res.statusCode}: ${body}`
              : `ElevenLabs HTTP ${res.statusCode}`;
            reject(new Error(message));
            return;
          }
          resolve(out);
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("Timeout ao chamar ElevenLabs.")));
    req.write(body);
    req.end();
  });
}

async function speakWithElevenLabs(text: string): Promise<SpeakResult> {
  const generateStart = performance.now();
  const pcm = await elevenLabsSynthesizePcm(text);
  const wavBuffer = pcmToWavBuffer(pcm, 16000);
  const tempFile = path.join(tmpdir(), `ferro-elevenlabs-${Date.now()}.wav`);

  const finalWav = settings.ttsVolume < 0.99 ? scaleWavVolume(wavBuffer, settings.ttsVolume) : wavBuffer;
  await writeFile(tempFile, finalWav);
  const generateMs = Math.round(performance.now() - generateStart);

  playWavFileAsync(tempFile);
  return { generateMs, playMs: 0, provider: "elevenlabs" };
}

export function scaleWavVolume(wavBuffer: Buffer, volume: number): Buffer {
  if (volume >= 0.99) return wavBuffer;
  const result = Buffer.from(wavBuffer);
  for (let i = 44; i < result.length - 1; i += 2) {
    const sample = result.readInt16LE(i);
    const scaled = Math.round(sample * volume);
    const clamped = Math.max(-32768, Math.min(32767, scaled));
    result.writeInt16LE(clamped, i);
  }
  return result;
}

export async function speak(text: string): Promise<SpeakResult> {
  if (!settings.ttsEnabled) {
    console.log(`[TTS disabled] ${text}`);
    return { generateMs: 0, playMs: 0, provider: "disabled" };
  }

  const phonetic = toPhonetic(text);
  const provider = settings.ttsProvider.toLowerCase();

  if (provider === "piper") {
    return await speakWithPiper(phonetic);
  }

  if (provider === "say") {
    return await speakWithSay(phonetic);
  }

  if (provider === "elevenlabs") {
    return await speakWithElevenLabs(phonetic);
  }

  if (provider === "auto") {
    try {
      return await speakWithPiper(phonetic);
    } catch {
      return await speakWithSay(phonetic);
    }
  }

  throw new Error(`TTS_PROVIDER invalido: ${settings.ttsProvider}`);
}

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { unlink } from "node:fs/promises";

import say from "say";

import { settings } from "./config.js";

const PHONETIC_MAP = [
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

export function toPhonetic(text) {
  let result = text;
  for (const [pattern, replacement] of PHONETIC_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function runProcess(command, args, inputText = "") {
  return new Promise((resolve, reject) => {
    // Set cwd to the directory of the command so DLLs are found
    const cwd = path.dirname(command);
    const spawnOpts = { stdio: ["pipe", "ignore", "pipe"] };
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

function playWavFileAsync(filePath) {
  const escapedPath = filePath.replace(/'/g, "''");

  playbackPromise = playbackPromise.then(() => new Promise((resolve) => {
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

async function speakWithPiper(text) {
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

  playWavFileAsync(tempFile);

  return { generateMs, playMs: 0, provider: "piper" };
}

function speakWithSay(text) {
  say.speak(text, settings.ttsVoice, 1.0, (error) => {
    if (error) {
      console.error("[TTS say] erro:", error.message);
    }
  });
  return { generateMs: 0, playMs: 0, provider: "say" };
}

export async function speak(text) {
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

  if (provider === "auto") {
    try {
      return await speakWithPiper(phonetic);
    } catch {
      return await speakWithSay(phonetic);
    }
  }

  throw new Error(`TTS_PROVIDER invalido: ${settings.ttsProvider}`);
}

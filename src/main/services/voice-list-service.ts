import { readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import https from "https";
import { gunzipSync, brotliDecompressSync, inflateSync } from "zlib";
import { exec } from "child_process";
import { getVoicesDir } from "./piper-installer";
import type { VoiceOption } from "../../shared/types";

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
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    console.warn("[voices:list-elevenlabs] skipped: empty API key");
    return [];
  }

  const startedAt = Date.now();
  const keyHint = cleanKey.length > 8
    ? `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)} (${cleanKey.length})`
    : `${cleanKey.slice(0, 2)}...(${cleanKey.length})`;
  console.log("[voices:list-elevenlabs] start key:", keyHint);

  const parseVoices = (payload: unknown): VoiceOption[] => {
    if (!payload || typeof payload !== "object") return [];
    const json = payload as { voices?: unknown[]; data?: unknown[] };
    const rawVoices = Array.isArray(json.voices)
      ? json.voices
      : Array.isArray(json.data)
        ? json.data
        : [];

    return rawVoices
      .map((v) => {
        const voice = v as { voice_id?: string; voiceId?: string; id?: string; name?: string };
        return {
          id: voice.voice_id ?? voice.voiceId ?? voice.id ?? "",
          name: voice.name ?? "Voz sem nome",
        };
      })
      .filter((v) => Boolean(v.id));
  };

  const fetchVoices = (url: string): Promise<VoiceOption[] | null> =>
    new Promise((resolve) => {
      const requestStartedAt = Date.now();
      const req = https.get(
        url,
        {
          headers: {
            "xi-api-key": cleanKey,
            Accept: "application/json",
            // Node's https client doesn't auto-decompress, so we request compressed payloads and decode them ourselves.
            "Accept-Encoding": "gzip, deflate, br",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            try {
              const raw = Buffer.concat(chunks);
              const encoding = String(res.headers["content-encoding"] || "").toLowerCase();
              const decoded = encoding.includes("br")
                ? brotliDecompressSync(raw)
                : encoding.includes("gzip")
                  ? gunzipSync(raw)
                  : encoding.includes("deflate")
                    ? inflateSync(raw)
                    : raw;
              const text = decoded.toString("utf8");
              const durationMs = Date.now() - requestStartedAt;
              console.log(
                "[voices:list-elevenlabs]",
                url,
                "status:",
                res.statusCode ?? "unknown",
                "encoding:",
                encoding || "identity",
                "bytes:",
                raw.length,
                "ms:",
                durationMs
              );

              if ((res.statusCode ?? 500) >= 400) {
                const snippet = text.slice(0, 160).replace(/\s+/g, " ");
                console.warn("[voices:list-elevenlabs] HTTP", res.statusCode, "from", url, snippet);
                resolve(null);
                return;
              }

              const parsed = JSON.parse(text) as unknown;
              const voices = parseVoices(parsed);
              console.log("[voices:list-elevenlabs]", url, "parsed voices:", voices.length);
              resolve(voices);
            } catch (error) {
              console.warn("[voices:list-elevenlabs] parse error from", url, (error as Error).message);
              resolve(null);
            }
          });
        }
      );
      req.on("error", (error) => {
        console.warn("[voices:list-elevenlabs] request error for", url, error.message);
        resolve(null);
      });
      req.setTimeout(12000, () => {
        req.destroy();
        resolve(null);
      });
    });

  const fromV2 = await fetchVoices("https://api.elevenlabs.io/v2/voices?page_size=100");
  if (fromV2 && fromV2.length > 0) {
    console.log("[voices:list-elevenlabs] success via v2 in", Date.now() - startedAt, "ms");
    return fromV2;
  }

  console.warn("[voices:list-elevenlabs] v2 returned empty or failed. Falling back to v1.");

  const fromV1 = await fetchVoices("https://api.elevenlabs.io/v1/voices");
  if (fromV1 && fromV1.length > 0) {
    console.log("[voices:list-elevenlabs] success via v1 in", Date.now() - startedAt, "ms");
    return fromV1;
  }

  if ((fromV2 && fromV2.length === 0) || (fromV1 && fromV1.length === 0)) {
    console.warn("[voices:list-elevenlabs] requests succeeded but no voices were returned for this key.");
  }

  console.warn("[voices:list-elevenlabs] no voices after all attempts in", Date.now() - startedAt, "ms");

  return [];
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

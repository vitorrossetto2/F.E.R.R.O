import { describe, expect, it } from "vitest";
import {
  cacheElevenVoices,
  friendlyTtsError,
  getCachedElevenVoices,
  getElevenCacheKey,
  getPiperRepairMessage,
} from "../src/renderer/features/tts-settings/index.js";

describe("tts settings helpers", () => {
  it("caches elevenlabs voices by trimmed key", () => {
    const cacheKey = getElevenCacheKey("  api-key  ");
    cacheElevenVoices(cacheKey, [{ id: "voice-1", name: "Voice 1" }]);
    expect(getCachedElevenVoices("api-key")).toEqual([{ id: "voice-1", name: "Voice 1" }]);
  });

  it("returns user-friendly elevenlabs errors", () => {
    expect(friendlyTtsError("elevenlabs", "HTTP 401 unauthorized")).toContain("invÃ¡lida");
    expect(friendlyTtsError("elevenlabs", "voice_id not found")).toContain("nÃ£o foi encontrada");
    expect(friendlyTtsError("system", "boom")).toBe("boom");
  });

  it("describes piper repair status", () => {
    expect(getPiperRepairMessage(null)).toContain("Verificando");
    expect(getPiperRepairMessage({
      piperBinaryInstalled: false,
      piperModelConfigured: false,
      piperModelExists: false,
    })).toContain("binario do Piper");
  });
});

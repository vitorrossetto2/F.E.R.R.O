import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import os from "os";

const VOICES_DIR = path.join(os.homedir(), ".micaai", "voices");

vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: (p: string) => p === VOICES_DIR ? true : (actual as typeof import("fs")).existsSync(p),
  };
});

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual("fs/promises");
  return {
    ...actual,
    readdir: async (dir: string) => {
      if (dir === VOICES_DIR) return ["pt_BR-faber-medium.onnx", "pt_BR-cadu-medium.onnx", "readme.txt"];
      return (actual as typeof import("fs/promises")).readdir(dir);
    },
  };
});

describe("voice-list-service", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("listPiperVoices", () => {
    it("returns only .onnx files with full paths as IDs", async () => {
      const { listPiperVoices } = await import("../src/main/services/voice-list-service.js");
      const voices = await listPiperVoices();

      expect(voices).toHaveLength(2);
      expect(voices[0].id).toBe(path.join(VOICES_DIR, "pt_BR-faber-medium.onnx"));
      expect(voices[0].name).toBe("faber medium");
      expect(voices[1].id).toBe(path.join(VOICES_DIR, "pt_BR-cadu-medium.onnx"));
    });

    it("voice IDs are full absolute paths", async () => {
      const { listPiperVoices } = await import("../src/main/services/voice-list-service.js");
      const voices = await listPiperVoices();

      for (const v of voices) {
        expect(path.isAbsolute(v.id)).toBe(true);
        expect(v.id).toContain(".micaai");
      }
    });
  });

  describe("listElevenLabsVoices", () => {
    it("returns empty array when apiKey is empty", async () => {
      const { listElevenLabsVoices } = await import("../src/main/services/voice-list-service.js");
      const voices = await listElevenLabsVoices("");
      expect(voices).toEqual([]);
    });
  });
});

import { describe, it, expect } from "vitest";
import os from "os";
import path from "path";

describe("piper-installer", () => {
  const MICAAI_DIR = path.join(os.homedir(), ".micaai");
  const PIPER_DIR = path.join(MICAAI_DIR, "piper");
  const VOICES_DIR = path.join(MICAAI_DIR, "voices");

  it("PIPER_VOICES has exactly 4 voices", async () => {
    const { PIPER_VOICES } = await import("../src/main/services/piper-installer.js");
    expect(PIPER_VOICES).toHaveLength(4);
  });

  it("all PIPER_VOICES have required fields", async () => {
    const { PIPER_VOICES } = await import("../src/main/services/piper-installer.js");
    for (const v of PIPER_VOICES) {
      expect(v).toHaveProperty("id");
      expect(v).toHaveProperty("name");
      expect(v).toHaveProperty("file");
      expect(v).toHaveProperty("size");
      expect(v.file).toMatch(/^pt_BR-/);
    }
  });

  it("voice IDs are unique", async () => {
    const { PIPER_VOICES } = await import("../src/main/services/piper-installer.js");
    const ids = PIPER_VOICES.map((v: { id: string }) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getPiperDir returns path inside ~/.micaai", async () => {
    const { getPiperDir } = await import("../src/main/services/piper-installer.js");
    expect(getPiperDir()).toBe(PIPER_DIR);
  });

  it("getVoicesDir returns path inside ~/.micaai", async () => {
    const { getVoicesDir } = await import("../src/main/services/piper-installer.js");
    expect(getVoicesDir()).toBe(VOICES_DIR);
  });

  it("checkPiper returns installed status based on piper.exe existence", async () => {
    const { checkPiper } = await import("../src/main/services/piper-installer.js");
    const status = checkPiper();
    expect(status).toHaveProperty("installed");
    expect(typeof status.installed).toBe("boolean");
    if (status.installed) {
      expect(status.path).toContain("piper.exe");
    }
  });

  it("PIPER_VOICES contains faber, cadu, jeff, edresson", async () => {
    const { PIPER_VOICES } = await import("../src/main/services/piper-installer.js");
    const ids = PIPER_VOICES.map((v: { id: string }) => v.id);
    expect(ids).toContain("faber-medium");
    expect(ids).toContain("cadu-medium");
    expect(ids).toContain("jeff-medium");
    expect(ids).toContain("edresson-low");
  });
});

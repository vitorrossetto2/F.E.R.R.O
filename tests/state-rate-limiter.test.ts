import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("dotenv/config", () => ({}));

describe("LoopState rate limiter", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("canSpeakGlobal returns true when no message has been spoken", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    expect(st.canSpeakGlobal(100)).toBe(true);
  });

  it("canSpeakGlobal returns false within 8 seconds of last speak", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.markGlobalSpeak(100);
    expect(st.canSpeakGlobal(105)).toBe(false);
    expect(st.canSpeakGlobal(111.9)).toBe(false);
  });

  it("canSpeakGlobal returns true after 12 seconds", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.markGlobalSpeak(100);
    expect(st.canSpeakGlobal(112)).toBe(true);
  });

  it("queueTriggers respects cap of 2, evicting lowest priority", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.queueTriggers(["lembrete de mapa", "ouro parado alto"]);
    expect(st.pendingTriggers).toHaveLength(2);
    st.queueTriggers(["dragão em 1 minuto"]);
    expect(st.pendingTriggers).toHaveLength(2);
    expect(st.pendingTriggers).toContain("dragão em 1 minuto");
  });

  it("reset clears rate limiter state", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.markGlobalSpeak(100);
    st.markGroupSpoken("inimigoPerigo", 100);
    st.reset();
    expect(st.canSpeakGlobal(101)).toBe(true);
    expect(st.canRepeatGroup("inimigoFed", 101)).toBe(true);
  });
});

describe("LoopState cooldown groups", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("canRepeatGroup returns true when group has not been spoken", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    expect(st.canRepeatGroup("inimigoFed", 100)).toBe(true);
  });

  it("canRepeatGroup returns false within 180s for same group", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.markGroupSpoken("inimigoPerigo", 100);
    expect(st.canRepeatGroup("inimigoFed", 200)).toBe(false);
    expect(st.canRepeatGroup("inimigoItem", 200)).toBe(false);
    expect(st.canRepeatGroup("inimigoBuild", 200)).toBe(false);
  });

  it("canRepeatGroup returns true after 180s", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    st.markGroupSpoken("inimigoPerigo", 100);
    expect(st.canRepeatGroup("inimigoFed", 280)).toBe(true);
  });

  it("canRepeatGroup returns true for categories not in any group", async () => {
    const { LoopState } = await import("../src/core/state.js");
    const st = new LoopState();
    expect(st.canRepeatGroup("mapa", 100)).toBe(true);
  });
});

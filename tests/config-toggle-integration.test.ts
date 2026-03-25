import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test: simulates the exact flow when user toggles a message category.
 *
 * Flow:
 * 1. Renderer calls: ferroAPI.setConfig("messages.mapa.enabled", false)
 * 2. IPC handler calls: configService.setPath("messages.mapa.enabled", false)
 * 3. configService.setPath calls: store.set("messages.mapa.enabled", false)
 * 4. Engine tick reads: configService.getAll().messages["mapa"].enabled
 *
 * The question: does step 4 see the value from step 3?
 */

// Track all store operations for debugging
const storeOps: string[] = [];
let storeData: Record<string, unknown> = {};

vi.mock("electron-store", () => {
  return {
    default: class MockStore {
      constructor(opts: { defaults?: Record<string, unknown> }) {
        storeData = opts.defaults ? JSON.parse(JSON.stringify(opts.defaults)) : {};
        storeOps.push("INIT");
      }
      get store() { return JSON.parse(JSON.stringify(storeData)); }
      get(key: string) {
        const keys = key.split(".");
        let obj: unknown = storeData;
        for (const k of keys) {
          if (obj === null || obj === undefined) return undefined;
          obj = (obj as Record<string, unknown>)[k];
        }
        storeOps.push(`GET ${key} = ${JSON.stringify(obj)}`);
        return obj;
      }
      set(key: string, value: unknown) {
        storeOps.push(`SET ${key} = ${JSON.stringify(value)}`);
        const keys = key.split(".");
        if (keys.length === 1) {
          storeData[key] = value;
          return;
        }
        let obj: Record<string, unknown> = storeData;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]] || typeof obj[keys[i]] !== "object") obj[keys[i]] = {};
          obj = obj[keys[i]] as Record<string, unknown>;
        }
        obj[keys[keys.length - 1]] = value;
      }
      clear() { storeData = {}; }
    },
  };
});

describe("config toggle integration", () => {
  beforeEach(async () => {
    vi.resetModules();
    storeOps.length = 0;
  });

  it("setPath('messages.mapa.enabled', false) persists and is readable by getAll()", async () => {
    const { initConfigStore, setPath, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    // Before toggle
    const before = getAll();
    expect(before.messages.mapa.enabled).toBe(true);

    // Simulate IPC handler: setPath("messages.mapa.enabled", false)
    setPath("messages.mapa.enabled", false);

    // After toggle — this is what the engine reads
    const after = getAll();
    expect(after.messages.mapa.enabled).toBe(false);
  });

  it("setPath('messages.objetivo.cooldownSeconds', 45) persists", async () => {
    const { initConfigStore, setPath, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    setPath("messages.objetivo.cooldownSeconds", 45);

    const config = getAll();
    expect(config.messages.objetivo.cooldownSeconds).toBe(45);
    // enabled should still be true (not wiped)
    expect(config.messages.objetivo.enabled).toBe(true);
  });

  it("multiple setPath calls don't wipe sibling values", async () => {
    const { initConfigStore, setPath, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    // Disable mapa
    setPath("messages.mapa.enabled", false);
    // Change mapa cooldown
    setPath("messages.mapa.cooldownSeconds", 100);

    const config = getAll();
    expect(config.messages.mapa.enabled).toBe(false);
    expect(config.messages.mapa.cooldownSeconds).toBe(100);

    // Other categories should be untouched
    expect(config.messages.objetivo.enabled).toBe(true);
    expect(config.messages.objetivo.cooldownSeconds).toBe(15);
  });

  it("engine category check works with disabled category", async () => {
    const { initConfigStore, setPath, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    // Disable mapa
    setPath("messages.mapa.enabled", false);

    // Simulate what engine.ts does in tick()
    const config = getAll();
    const category = "mapa"; // from detectCategory()
    const msgConfig = config.messages[category];

    // This is the check in engine.ts line 278
    const shouldSkip = msgConfig && !msgConfig.enabled;
    expect(shouldSkip).toBe(true);
  });

  it("engine category check allows enabled category", async () => {
    const { initConfigStore, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    const config = getAll();
    const category = "objetivo";
    const msgConfig = config.messages[category];

    const shouldSkip = msgConfig && !msgConfig.enabled;
    expect(shouldSkip).toBe(false);
  });

  it("setPath('coach.messageMode', 'meme') persists without touching message toggles", async () => {
    const { initConfigStore, setPath, getAll } = await import("../src/main/services/config-service.js");
    initConfigStore();

    setPath("coach.messageMode", "meme");

    const config = getAll();
    expect(config.coach.messageMode).toBe("meme");
    expect(config.messages.objetivo.enabled).toBe(true);
    expect(config.messages.objetivo.cooldownSeconds).toBe(15);
  });
});

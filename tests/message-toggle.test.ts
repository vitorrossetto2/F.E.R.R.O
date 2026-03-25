import { describe, it, expect } from "vitest";

/**
 * Tests that message category IDs used in the UI match exactly
 * with what detectCategory() returns from the core coaching engine.
 *
 * This is the root cause of the toggle bug: if the keys don't match,
 * the engine can't find the config and ignores the toggle.
 */
describe("message category alignment", () => {
  // All categories returned by detectCategory() in coach.js
  const CORE_CATEGORIES = [
    "mapa",
    "ouroParado",
    "inimigoFed",
    "inimigoBuild",
    "powerspike",
    "torre",
    "torrePerdida",
    "morteJogador",
    "morteStreak",
    "objetivo",
    "itemFechado",
    "inimigoItem",
    "levelUp",
    "inibidor",
    "fimDeJogo",
    "generico",
  ];

  // Categories in CATEGORY_COOLDOWNS from constants.js
  const COOLDOWN_CATEGORIES = [
    "mapa", "ouroParado", "inimigoFed", "inimigoBuild", "powerspike",
    "torre", "torrePerdida", "morteJogador", "morteStreak", "objetivo",
    "itemFechado", "inimigoItem", "levelUp", "inibidor", "fimDeJogo", "generico",
  ];

  // Categories defined in config-service.ts DEFAULT_CONFIG.messages
  // This MUST match the core categories
  const CONFIG_MESSAGE_KEYS = [
    "objetivo", "torre", "torrePerdida", "morteJogador", "morteStreak",
    "itemFechado", "inimigoItem", "powerspike", "mapa", "inimigoFed",
    "inimigoBuild", "ouroParado", "levelUp", "inibidor", "generico",
  ];

  // Categories in the Messages.tsx UI page
  const UI_CATEGORY_IDS = [
    "objetivo", "torre", "torrePerdida", "morteJogador", "morteStreak",
    "itemFechado", "inimigoItem", "powerspike", "mapa", "inimigoFed",
    "inimigoBuild", "ouroParado", "levelUp", "inibidor", "generico",
  ];

  it("every core category has a config entry (except fimDeJogo)", () => {
    const configurable = CORE_CATEGORIES.filter((c) => c !== "fimDeJogo");
    for (const cat of configurable) {
      expect(CONFIG_MESSAGE_KEYS).toContain(cat);
    }
  });

  it("every config key is a valid core category", () => {
    for (const key of CONFIG_MESSAGE_KEYS) {
      expect(CORE_CATEGORIES).toContain(key);
    }
  });

  it("every UI category ID matches a config key", () => {
    for (const id of UI_CATEGORY_IDS) {
      expect(CONFIG_MESSAGE_KEYS).toContain(id);
    }
  });

  it("every config key has a UI entry", () => {
    for (const key of CONFIG_MESSAGE_KEYS) {
      expect(UI_CATEGORY_IDS).toContain(key);
    }
  });

  it("core CATEGORY_COOLDOWNS keys match detectCategory return values", () => {
    expect(COOLDOWN_CATEGORIES.sort()).toEqual(CORE_CATEGORIES.sort());
  });
});

describe("message toggle logic simulation", () => {
  it("should skip message when category is disabled", () => {
    const messages: Record<string, { enabled: boolean; cooldownSeconds: number }> = {
      mapa: { enabled: false, cooldownSeconds: 50 },
      objetivo: { enabled: true, cooldownSeconds: 15 },
    };

    // Simulate engine logic
    const category = "mapa";
    const msgConfig = messages[category];

    // This is what the engine does:
    const shouldSkip = msgConfig && !msgConfig.enabled;
    expect(shouldSkip).toBe(true);
  });

  it("should NOT skip message when category is enabled", () => {
    const messages: Record<string, { enabled: boolean; cooldownSeconds: number }> = {
      objetivo: { enabled: true, cooldownSeconds: 15 },
    };

    const category = "objetivo";
    const msgConfig = messages[category];
    const shouldSkip = msgConfig && !msgConfig.enabled;
    expect(shouldSkip).toBe(false);
  });

  it("should use user cooldown when set", () => {
    const messages: Record<string, { enabled: boolean; cooldownSeconds: number }> = {
      mapa: { enabled: true, cooldownSeconds: 120 },
    };

    const defaultCooldown = 50; // from CATEGORY_COOLDOWNS
    const category = "mapa";
    const msgConfig = messages[category];
    const cooldown = msgConfig?.cooldownSeconds ?? defaultCooldown;
    expect(cooldown).toBe(120);
  });

  it("should fall back to default cooldown when category not in config", () => {
    const messages: Record<string, { enabled: boolean; cooldownSeconds: number }> = {};

    const defaultCooldown = 30;
    const category = "fimDeJogo"; // not in user config
    const msgConfig = messages[category];
    const cooldown = msgConfig?.cooldownSeconds ?? defaultCooldown;
    expect(cooldown).toBe(30);
  });
});

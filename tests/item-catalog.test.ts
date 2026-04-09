import { describe, expect, it } from "vitest";

import { ItemCatalog } from "../src/core/item-catalog";

describe("ItemCatalog", () => {
  it("finds an item by its exact name", () => {
    const catalog = ItemCatalog.loadDefault();

    const result = catalog.lookupItemByName("Botas");

    expect(result.item?.id).toBe("1001");
    expect(result.item?.name).toBe("Botas");
    expect(result.matches).toHaveLength(1);
  });

  it("finds an item by alias from colloq", () => {
    const catalog = ItemCatalog.loadDefault();

    const result = catalog.lookupItemByName("boot");

    expect(result.item?.id).toBe("1001");
    expect(result.item?.name).toBe("Botas");
  });

  it("returns the best fuzzy match for partial names", () => {
    const catalog = ItemCatalog.loadDefault();

    const result = catalog.lookupItemByName("rubi");

    expect(result.item?.id).toBe("1028");
    expect(result.item?.name).toBe("Cristal de Rubi");
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

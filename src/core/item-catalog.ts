import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ItemCatalogItem {
  id: string;
  name: string;
  description: string;
  colloq: string;
  plaintext: string;
  tags: string[];
  from: string[];
  into: string[];
  gold: {
    base?: number;
    total?: number;
    sell?: number;
    purchasable?: boolean;
  };
  stats: Record<string, number>;
  maps: Record<string, boolean>;
  image?: {
    full?: string;
    sprite?: string;
    group?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
  effect?: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ItemLookupResult {
  query: string;
  normalizedQuery: string;
  item: ItemCatalogItem | null;
  matches: ItemCatalogItem[];
}

interface RawItemsFile {
  data?: Record<string, Record<string, unknown>>;
}

interface IndexedItem {
  item: ItemCatalogItem;
  searchKeys: string[];
}

const DEFAULT_ITEMS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../data/items.json"
);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeItemName(value: string): string {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function splitAliases(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }
  return result;
}

function toBooleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "boolean") {
      result[key] = raw;
    }
  }
  return result;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") {
      record[key] = raw;
    }
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

function buildItemCatalogItem(id: string, raw: Record<string, unknown>): ItemCatalogItem {
  const name = typeof raw.name === "string" ? raw.name : "";
  const colloq = typeof raw.colloq === "string" ? raw.colloq : "";
  const plaintext = typeof raw.plaintext === "string" ? raw.plaintext : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  const tags = toStringArray(raw.tags);
  const from = toStringArray(raw.from);
  const into = toStringArray(raw.into);
  const gold = raw.gold && typeof raw.gold === "object"
    ? {
        base: typeof (raw.gold as Record<string, unknown>).base === "number" ? (raw.gold as Record<string, unknown>).base as number : undefined,
        total: typeof (raw.gold as Record<string, unknown>).total === "number" ? (raw.gold as Record<string, unknown>).total as number : undefined,
        sell: typeof (raw.gold as Record<string, unknown>).sell === "number" ? (raw.gold as Record<string, unknown>).sell as number : undefined,
        purchasable: typeof (raw.gold as Record<string, unknown>).purchasable === "boolean" ? (raw.gold as Record<string, unknown>).purchasable as boolean : undefined
      }
    : {};
  const image = raw.image && typeof raw.image === "object"
    ? {
        full: typeof (raw.image as Record<string, unknown>).full === "string" ? (raw.image as Record<string, unknown>).full as string : undefined,
        sprite: typeof (raw.image as Record<string, unknown>).sprite === "string" ? (raw.image as Record<string, unknown>).sprite as string : undefined,
        group: typeof (raw.image as Record<string, unknown>).group === "string" ? (raw.image as Record<string, unknown>).group as string : undefined,
        x: typeof (raw.image as Record<string, unknown>).x === "number" ? (raw.image as Record<string, unknown>).x as number : undefined,
        y: typeof (raw.image as Record<string, unknown>).y === "number" ? (raw.image as Record<string, unknown>).y as number : undefined,
        w: typeof (raw.image as Record<string, unknown>).w === "number" ? (raw.image as Record<string, unknown>).w as number : undefined,
        h: typeof (raw.image as Record<string, unknown>).h === "number" ? (raw.image as Record<string, unknown>).h as number : undefined
      }
    : undefined;

  return {
    id,
    name,
    description,
    colloq,
    plaintext,
    tags,
    from,
    into,
    gold,
    stats: toNumberMap(raw.stats),
    maps: toBooleanMap(raw.maps),
    image,
    effect: toRecord(raw.effect),
    raw
  };
}

function scoreMatch(query: string, item: IndexedItem): number {
  let bestScore = 0;
  for (const key of item.searchKeys) {
    if (!key) continue;
    if (key === query) {
      return 100;
    }
    if (key.startsWith(query)) {
      bestScore = Math.max(bestScore, 80);
      continue;
    }
    if (key.includes(query)) {
      bestScore = Math.max(bestScore, 60);
    }
  }

  if (bestScore > 0) {
    return bestScore;
  }

  const queryParts = query.match(/[a-z0-9]+/g) ?? [];
  if (queryParts.length === 0) {
    return 0;
  }

  const searchable = item.searchKeys.join(" ");
  if (queryParts.every((part) => searchable.includes(part))) {
    return 40;
  }

  return 0;
}

export class ItemCatalog {
  private static defaultInstance: ItemCatalog | null = null;

  private readonly indexedItems: IndexedItem[];
  private readonly itemsById: Map<string, ItemCatalogItem>;
  private readonly itemsByKey: Map<string, ItemCatalogItem>;

  constructor(items: Record<string, Record<string, unknown>>) {
    this.indexedItems = [];
    this.itemsById = new Map<string, ItemCatalogItem>();
    this.itemsByKey = new Map<string, ItemCatalogItem>();

    for (const [id, raw] of Object.entries(items)) {
      const item = buildItemCatalogItem(id, raw);
      const aliasSet = new Set<string>([
        item.name,
        ...splitAliases(item.colloq),
        id
      ]);
      const searchKeys = [...aliasSet].map(normalizeItemName).filter(Boolean);

      this.indexedItems.push({ item, searchKeys });
      this.itemsById.set(id, item);

      for (const key of searchKeys) {
        if (!this.itemsByKey.has(key)) {
          this.itemsByKey.set(key, item);
        }
      }
    }
  }

  static loadDefault(): ItemCatalog {
    if (!ItemCatalog.defaultInstance) {
      const raw = JSON.parse(readFileSync(DEFAULT_ITEMS_PATH, "utf-8")) as RawItemsFile;
      ItemCatalog.defaultInstance = new ItemCatalog(raw.data ?? {});
    }

    return ItemCatalog.defaultInstance;
  }

  getItemById(id: string): ItemCatalogItem | null {
    return this.itemsById.get(id) ?? null;
  }

  searchItemsByName(query: string, limit = 5): ItemCatalogItem[] {
    const normalizedQuery = normalizeItemName(query);
    if (!normalizedQuery) {
      return [];
    }

    const ranked = this.indexedItems
      .map((entry) => ({ item: entry.item, score: scoreMatch(normalizedQuery, entry) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.item.name.localeCompare(right.item.name, "pt-BR");
      });

    return ranked.slice(0, limit).map((entry) => entry.item);
  }

  lookupItemByName(query: string): ItemLookupResult {
    const normalizedQuery = normalizeItemName(query);
    if (!normalizedQuery) {
      return {
        query,
        normalizedQuery,
        item: null,
        matches: []
      };
    }

    const direct = this.itemsByKey.get(normalizedQuery) ?? null;
    if (direct) {
      return {
        query,
        normalizedQuery,
        item: direct,
        matches: [direct]
      };
    }

    const matches = this.searchItemsByName(query, 5);
    return {
      query,
      normalizedQuery,
      item: matches[0] ?? null,
      matches
    };
  }
}


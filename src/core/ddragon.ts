import axios from "axios";

import { settings } from "./config";

interface DDragonItem {
  name: string;
  tags?: string[];
  gold?: { total?: number };
  into?: string[];
}

interface DDragonChampion {
  name: string;
  tags?: string[];
}

type ItemCatalog = Map<string, DDragonItem>;
type ChampionCatalog = Map<string, DDragonChampion>;

let itemCatalogPromise: Promise<ItemCatalog> | undefined;
let championCatalogPromise: Promise<ChampionCatalog> | undefined;

const FALLBACK_ITEMS = {
  "1001": { name: "Boots", tags: ["Boots"], gold: { total: 300 }, into: ["3006","3047","3111","3117","3158","3009","3020"] },
  "3006": { name: "Berserker's Greaves", tags: ["Boots","AttackSpeed"], gold: { total: 1100 }, into: [] },
  "3009": { name: "Boots of Swiftness", tags: ["Boots"], gold: { total: 1000 }, into: [] },
  "3020": { name: "Sorcerer's Shoes", tags: ["Boots"], gold: { total: 1100 }, into: [] },
  "3047": { name: "Plated Steelcaps", tags: ["Boots","Armor"], gold: { total: 1100 }, into: [] },
  "3111": { name: "Mercury's Treads", tags: ["Boots","SpellBlock"], gold: { total: 1100 }, into: [] },
  "3117": { name: "Mobility Boots", tags: ["Boots"], gold: { total: 1000 }, into: [] },
  "3158": { name: "Ionian Boots of Lucidity", tags: ["Boots","CooldownReduction"], gold: { total: 950 }, into: [] },
  "3031": { name: "Infinity Edge", tags: ["Damage","CriticalStrike"], gold: { total: 3450 }, into: [] },
  "3036": { name: "Lord Dominik's Regards", tags: ["Damage","ArmorPenetration"], gold: { total: 3000 }, into: [] },
  "3046": { name: "Phantom Dancer", tags: ["AttackSpeed","CriticalStrike"], gold: { total: 2800 }, into: [] },
  "3065": { name: "Spirit Visage", tags: ["Health","SpellBlock","HealthRegen"], gold: { total: 2900 }, into: [] },
  "3068": { name: "Sunfire Aegis", tags: ["Health","Armor"], gold: { total: 2700 }, into: [] },
  "3071": { name: "Black Cleaver", tags: ["Damage","Health"], gold: { total: 3000 }, into: [] },
  "3072": { name: "Bloodthirster", tags: ["Damage","LifeSteal"], gold: { total: 3400 }, into: [] },
  "3074": { name: "Ravenous Hydra", tags: ["Damage","LifeSteal"], gold: { total: 3300 }, into: [] },
  "3075": { name: "Thornmail", tags: ["Armor","Health"], gold: { total: 2700 }, into: [] },
  "3078": { name: "Trinity Force", tags: ["Damage","AttackSpeed","Health"], gold: { total: 3333 }, into: [] },
  "3083": { name: "Warmog's Armor", tags: ["Health","HealthRegen"], gold: { total: 3000 }, into: [] },
  "3085": { name: "Runaan's Hurricane", tags: ["AttackSpeed","CriticalStrike"], gold: { total: 2800 }, into: [] },
  "3089": { name: "Rabadon's Deathcap", tags: ["SpellDamage"], gold: { total: 3600 }, into: [] },
  "3100": { name: "Lich Bane", tags: ["SpellDamage"], gold: { total: 3000 }, into: [] },
  "3102": { name: "Banshee's Veil", tags: ["SpellDamage","SpellBlock"], gold: { total: 2600 }, into: [] },
  "3110": { name: "Frozen Heart", tags: ["Armor","Mana","CooldownReduction"], gold: { total: 2500 }, into: [] },
  "3115": { name: "Nashor's Tooth", tags: ["SpellDamage","AttackSpeed"], gold: { total: 3000 }, into: [] },
  "3116": { name: "Rylai's Crystal Scepter", tags: ["SpellDamage","Health"], gold: { total: 2600 }, into: [] },
  "3135": { name: "Void Staff", tags: ["SpellDamage","MagicPenetration"], gold: { total: 2800 }, into: [] },
  "3139": { name: "Mercurial Scimitar", tags: ["Damage","SpellBlock","LifeSteal"], gold: { total: 3000 }, into: [] },
  "3142": { name: "Youmuu's Ghostblade", tags: ["Damage","ArmorPenetration"], gold: { total: 2800 }, into: [] },
  "3143": { name: "Randuin's Omen", tags: ["Health","Armor"], gold: { total: 2700 }, into: [] },
  "3153": { name: "Blade of the Ruined King", tags: ["Damage","AttackSpeed","LifeSteal"], gold: { total: 3200 }, into: [] },
  "3156": { name: "Maw of Malmortius", tags: ["Damage","SpellBlock"], gold: { total: 2800 }, into: [] },
  "3157": { name: "Zhonya's Hourglass", tags: ["SpellDamage","Armor"], gold: { total: 2600 }, into: [] },
  "3165": { name: "Morellonomicon", tags: ["SpellDamage","Health"], gold: { total: 2500 }, into: [] },
  "3033": { name: "Mortal Reminder", tags: ["Damage","ArmorPenetration"], gold: { total: 3200 }, into: [] },
  "3181": { name: "Hullbreaker", tags: ["Damage","Health"], gold: { total: 2800 }, into: [] },
  "3190": { name: "Locket of the Iron Solari", tags: ["Health","Armor","SpellBlock"], gold: { total: 2500 }, into: [] },
  "3193": { name: "Gargoyle Stoneplate", tags: ["Armor","SpellBlock"], gold: { total: 3200 }, into: [] },
  "3364": { name: "Oracle Lens", tags: ["Trinket"], gold: { total: 0 }, into: [] },
  "3340": { name: "Stealth Ward", tags: ["Trinket"], gold: { total: 0 }, into: [] },
  "2031": { name: "Refillable Potion", tags: ["Consumable"], gold: { total: 150 }, into: [] },
  "2003": { name: "Health Potion", tags: ["Consumable"], gold: { total: 50 }, into: [] }
};

const FALLBACK_CHAMPIONS = {
  Ahri: { name: "Ahri", tags: ["Mage", "Assassin"] },
  Akali: { name: "Akali", tags: ["Assassin"] },
  Aatrox: { name: "Aatrox", tags: ["Fighter", "Tank"] },
  Annie: { name: "Annie", tags: ["Mage"] },
  Ashe: { name: "Ashe", tags: ["Marksman", "Support"] },
  Camille: { name: "Camille", tags: ["Fighter", "Assassin"] },
  Caitlyn: { name: "Caitlyn", tags: ["Marksman"] },
  Darius: { name: "Darius", tags: ["Fighter", "Tank"] },
  Diana: { name: "Diana", tags: ["Fighter", "Mage"] },
  Draven: { name: "Draven", tags: ["Marksman"] },
  Ezreal: { name: "Ezreal", tags: ["Marksman", "Mage"] },
  Fiora: { name: "Fiora", tags: ["Fighter", "Assassin"] },
  Garen: { name: "Garen", tags: ["Fighter", "Tank"] },
  Jax: { name: "Jax", tags: ["Fighter"] },
  Jinx: { name: "Jinx", tags: ["Marksman"] },
  KaiSa: { name: "Kai'Sa", tags: ["Marksman", "Assassin"] },
  Katarina: { name: "Katarina", tags: ["Assassin", "Mage"] },
  Kindred: { name: "Kindred", tags: ["Marksman", "Assassin"] },
  LeeSin: { name: "Lee Sin", tags: ["Fighter", "Assassin"] },
  Leona: { name: "Leona", tags: ["Tank", "Support"] },
  Lux: { name: "Lux", tags: ["Mage", "Support"] },
  Malphite: { name: "Malphite", tags: ["Tank"] },
  Morgana: { name: "Morgana", tags: ["Mage", "Support"] },
  Mordekaiser: { name: "Mordekaiser", tags: ["Fighter", "Tank"] },
  Nautilus: { name: "Nautilus", tags: ["Tank", "Support"] },
  Orianna: { name: "Orianna", tags: ["Mage"] },
  Poppy: { name: "Poppy", tags: ["Tank", "Fighter"] },
  Rakan: { name: "Rakan", tags: ["Support", "Tank"] },
  RenataGlasc: { name: "Renata Glasc", tags: ["Support", "Mage"] },
  Riven: { name: "Riven", tags: ["Fighter", "Assassin"] },
  Samira: { name: "Samira", tags: ["Marksman", "Assassin"] },
  Senna: { name: "Senna", tags: ["Marksman", "Support"] },
  Seraphine: { name: "Seraphine", tags: ["Mage", "Support"] },
  Shen: { name: "Shen", tags: ["Tank", "Support"] },
  Shyvana: { name: "Shyvana", tags: ["Fighter", "Mage"] },
  Sion: { name: "Sion", tags: ["Tank", "Fighter"] },
  Soraka: { name: "Soraka", tags: ["Support", "Mage"] },
  Syndra: { name: "Syndra", tags: ["Mage"] },
  Thresh: { name: "Thresh", tags: ["Support", "Tank"] },
  Tristana: { name: "Tristana", tags: ["Marksman", "Assassin"] },
  Vayne: { name: "Vayne", tags: ["Marksman", "Assassin"] },
  Viktor: { name: "Viktor", tags: ["Mage"] },
  Vi: { name: "Vi", tags: ["Fighter", "Assassin"] },
  Xayah: { name: "Xayah", tags: ["Marksman"] },
  Yasuo: { name: "Yasuo", tags: ["Fighter", "Assassin"] },
  Yone: { name: "Yone", tags: ["Fighter", "Assassin"] },
  Zed: { name: "Zed", tags: ["Assassin"] },
  Zeri: { name: "Zeri", tags: ["Marksman"] },
  Zoe: { name: "Zoe", tags: ["Mage", "Assassin"] }
} satisfies Record<string, DDragonChampion>;

function normalizeChampionKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchLatestVersion(): Promise<string | undefined> {
  const response = await axios.get(settings.ddragonVersionsUrl, { timeout: 5000 });
  const versions = Array.isArray(response.data) ? response.data : [];
  return versions[0];
}

async function fetchItemCatalog(): Promise<ItemCatalog> {
  const version = await fetchLatestVersion();
  if (!version) {
    return new Map<string, DDragonItem>();
  }

  const response = await axios.get(
    `${settings.ddragonCdnUrl}/${version}/data/pt_BR/item.json`,
    { timeout: 5000 }
  );
  const items = (response.data?.data ?? {}) as Record<string, DDragonItem>;
  return new Map<string, DDragonItem>(Object.entries(items));
}

export async function getItemCatalog(): Promise<ItemCatalog> {
  if (!itemCatalogPromise) {
    itemCatalogPromise = fetchItemCatalog().catch((error) => {
      console.error("[DDragon] Falha ao buscar catalogo de itens, usando fallback:", error.message);
      return new Map<string, DDragonItem>(Object.entries(FALLBACK_ITEMS));
    });
  }

  return itemCatalogPromise;
}

async function fetchChampionCatalog(): Promise<ChampionCatalog> {
  const version = await fetchLatestVersion();
  if (!version) {
    return new Map<string, DDragonChampion>();
  }

  const response = await axios.get(
    `${settings.ddragonCdnUrl}/${version}/data/pt_BR/champion.json`,
    { timeout: 5000 }
  );
  const champions = (response.data?.data ?? {}) as Record<string, DDragonChampion>;
  return new Map<string, DDragonChampion>(
    Object.values(champions).flatMap((champion) => {
      const keys = new Set<string>([
        normalizeChampionKey(champion.name ?? ""),
        normalizeChampionKey((champion as { id?: string }).id ?? "")
      ]);
      return [...keys]
        .filter(Boolean)
        .map((key) => [key, champion] as const);
    })
  );
}

export async function getChampionCatalog(): Promise<ChampionCatalog> {
  if (!championCatalogPromise) {
    championCatalogPromise = fetchChampionCatalog().catch((error) => {
      console.error("[DDragon] Falha ao buscar catalogo de campeoes, usando fallback:", error.message);
      return new Map<string, DDragonChampion>(
        Object.entries(FALLBACK_CHAMPIONS).flatMap(([key, champion]) => {
          const normalized = normalizeChampionKey(champion.name ?? key);
          return [
            [normalized, champion] as const,
            [normalizeChampionKey(key), champion] as const
          ];
        })
      );
    });
  }

  return championCatalogPromise;
}



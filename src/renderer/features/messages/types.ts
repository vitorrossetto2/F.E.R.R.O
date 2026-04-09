import type { MessageCategoryConfig } from "../../../shared/types";

export type MessageCategoryId =
  | "objetivo"
  | "torre"
  | "torrePerdida"
  | "morteJogador"
  | "morteStreak"
  | "itemFechado"
  | "inimigoItem"
  | "powerspike"
  | "mapa"
  | "inimigoFed"
  | "inimigoBuild"
  | "ouroParado"
  | "levelUp"
  | "inibidor"
  | "generico";

export interface MessageCategoryDefinition {
  id: MessageCategoryId;
  label: string;
  desc: string;
}

export interface MessageGroupDefinition {
  id: string;
  title: string;
  desc: string;
  categories: MessageCategoryId[];
}

export interface MessagePresetDefinition {
  id: string;
  label: string;
  desc: string;
  config: Record<MessageCategoryId, MessageCategoryConfig>;
}

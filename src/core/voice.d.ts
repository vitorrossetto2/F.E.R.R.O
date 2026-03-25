export interface SpeakResult {
  generateMs: number;
  playMs: number;
  provider: string;
}

export function toPhonetic(text: string): string;

export function speak(text: string): Promise<SpeakResult>;
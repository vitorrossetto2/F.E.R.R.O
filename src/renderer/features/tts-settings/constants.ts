import type { TTSProviderType } from "../../../shared/types";

export const TTS_PROVIDERS: { id: TTSProviderType; name: string; desc: string; badge: string }[] = [
  { id: "piper", name: "Piper", desc: "Local, rÃ¡pido, PT-BR", badge: "Gratuito" },
  { id: "elevenlabs", name: "ElevenLabs", desc: "Voz natural na nuvem", badge: "Pago" },
  { id: "system", name: "Sistema", desc: "Voz do Windows", badge: "Gratuito" },
];

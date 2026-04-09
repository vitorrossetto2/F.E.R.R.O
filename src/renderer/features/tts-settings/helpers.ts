import type { TTSProviderType, VoiceOption } from "../../../shared/types";

const elevenVoicesCache = new Map<string, VoiceOption[]>();

export function getElevenCacheKey(apiKey: string) {
  return apiKey.trim();
}

export function getCachedElevenVoices(cacheKey: string) {
  return elevenVoicesCache.get(cacheKey) ?? [];
}

export function cacheElevenVoices(cacheKey: string, voices: VoiceOption[]) {
  if (!cacheKey) return;
  elevenVoicesCache.set(cacheKey, voices);
}

export function friendlyTtsError(provider: TTSProviderType, rawError?: string): string {
  const fallback = rawError || "Erro";
  if (provider !== "elevenlabs") return fallback;

  const msg = fallback.toLowerCase();
  if (/subscription_required|current plan|ivc_not_permitted|instantly cloned voices/.test(msg)) {
    return "A voz selecionada exige um plano ElevenLabs com acesso a instantly cloned voices.";
  }
  if (/http\\s*401|invalid[_\\s-]?api[_\\s-]?key|unauthorized/.test(msg)) {
    return "Chave da ElevenLabs invÃ¡lida. Verifique a API Key e tente novamente.";
  }
  if (/http\\s*403|forbidden|permission|permission_denied/.test(msg)) {
    return "Sua chave da ElevenLabs nÃ£o tem permissÃ£o para este recurso de voz.";
  }
  if (/http\\s*404|voice[_\\s-]?id|voice.+not\\s+found/.test(msg)) {
    return "A voz selecionada nÃ£o foi encontrada. Clique em \"Buscar vozes\" e escolha outra.";
  }
  if (/http\\s*429|quota|credit|limit|rate\\s*limit|payment/.test(msg)) {
    return "Limite de uso/crÃ©ditos da ElevenLabs atingido. Verifique seu plano.";
  }
  return `Erro ElevenLabs: ${fallback}`;
}

export function getPiperRepairMessage(startupState: {
  piperBinaryInstalled: boolean;
  piperModelConfigured: boolean;
  piperModelExists: boolean;
} | null) {
  if (!startupState) return "Verificando instalacao do Piper...";
  if (!startupState.piperBinaryInstalled) {
    return "O binario do Piper nao esta instalado. Baixe uma voz para reinstalar o motor e o modelo.";
  }
  if (!startupState.piperModelConfigured) {
    return "Nenhuma voz Piper esta configurada. Selecione uma voz instalada ou baixe uma nova.";
  }
  if (!startupState.piperModelExists) {
    return "A voz configurada nao foi encontrada no disco. Baixe novamente ou selecione outra voz.";
  }
  return "Binario instalado e voz configurada corretamente.";
}

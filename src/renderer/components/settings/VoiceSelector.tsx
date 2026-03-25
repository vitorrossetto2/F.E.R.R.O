import { useEffect, useState } from "react";
import type { VoiceOption, TTSProviderType } from "../../../shared/types.js";

interface Props {
  provider: TTSProviderType;
  apiKey?: string;
  value: string;
  onChange: (voiceId: string) => void;
}

export default function VoiceSelector({ provider, apiKey, value, onChange }: Props) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setVoices([]);

    const load = async () => {
      try {
        let result: VoiceOption[] = [];
        if (provider === "piper") {
          result = (await window.micaAPI.listPiperVoices()) as VoiceOption[];
        } else if (provider === "elevenlabs" && apiKey) {
          result = (await window.micaAPI.listElevenLabsVoices(apiKey)) as VoiceOption[];
        } else if (provider === "system") {
          result = (await window.micaAPI.listSystemVoices()) as VoiceOption[];
        }
        setVoices(result);
      } catch {
        setVoices([]);
      }
      setLoading(false);
    };

    // Debounce ElevenLabs (API key might be typing)
    if (provider === "elevenlabs") {
      const timer = setTimeout(load, 800);
      return () => clearTimeout(timer);
    }
    load();
  }, [provider, apiKey]);

  const label = provider === "piper" ? "Voz instalada" : provider === "elevenlabs" ? "Voz ElevenLabs" : "Voz do sistema";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <select
        className="select-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        {loading && <option>Carregando...</option>}
        {!loading && voices.length === 0 && <option value="">Nenhuma voz encontrada</option>}
        {voices.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
    </div>
  );
}

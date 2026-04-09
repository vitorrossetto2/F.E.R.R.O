import type { FerroConfig, PiperProgress, PiperVoiceOption, TTSProviderType, VoiceOption } from "../../../../shared/types";
import APIKeyInput from "../../../components/settings/APIKeyInput";
import VoiceSelector from "../../../components/settings/VoiceSelector";
import { TTS_PROVIDERS } from "../constants";
import { getPiperRepairMessage } from "../helpers";

export function ProviderCards({
  activeProvider,
  onSelectProvider,
}: {
  activeProvider: TTSProviderType;
  onSelectProvider: (provider: TTSProviderType) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TTS_PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          onClick={() => onSelectProvider(provider.id)}
          className="card-glass px-3 py-3 text-left"
          style={{
            borderColor: activeProvider === provider.id ? "var(--glow-purple)" : undefined,
            boxShadow: activeProvider === provider.id ? "0 0 12px rgba(124, 91, 245, 0.12)" : undefined,
            cursor: "pointer",
            background: activeProvider === provider.id ? "var(--bg-elevated)" : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: activeProvider === provider.id ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {provider.name}
            </p>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: provider.badge === "Gratuito" ? "rgba(52, 211, 153, 0.12)" : "rgba(245, 166, 35, 0.12)",
                color: provider.badge === "Gratuito" ? "var(--accent-green)" : "var(--accent-orange)",
              }}
            >
              {provider.badge}
            </span>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {provider.desc}
          </p>
        </button>
      ))}
    </div>
  );
}

export function PiperSection({
  config,
  startupState,
  piperNeedsRepair,
  voiceKey,
  showDownload,
  availableVoices,
  installedFiles,
  downloadingVoice,
  downloadProgress,
  onUpdate,
  onToggleDownloads,
  onInstallVoice,
}: {
  config: FerroConfig;
  startupState: { piperBinaryInstalled: boolean; piperModelConfigured: boolean; piperModelExists: boolean } | null;
  piperNeedsRepair: boolean;
  voiceKey: number;
  showDownload: boolean;
  availableVoices: PiperVoiceOption[];
  installedFiles: string[];
  downloadingVoice: string | null;
  downloadProgress: PiperProgress | null;
  onUpdate: (path: string, value: unknown) => Promise<unknown>;
  onToggleDownloads: () => Promise<void>;
  onInstallVoice: (voiceId: string) => Promise<void>;
}) {
  return (
    <>
      <div
        className="rounded-xl px-3 py-3 text-sm"
        style={{
          background: piperNeedsRepair ? "rgba(245, 166, 35, 0.12)" : "rgba(52, 211, 153, 0.08)",
          border: `1px solid ${piperNeedsRepair ? "rgba(245, 166, 35, 0.25)" : "rgba(52, 211, 153, 0.18)"}`,
          color: "var(--text-primary)",
        }}
      >
        <p className="font-medium">
          {piperNeedsRepair ? "Piper precisa de reparo" : "Piper pronto para uso"}
        </p>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {getPiperRepairMessage(startupState)}
        </p>
      </div>

      <VoiceSelector
        key={voiceKey}
        provider="piper"
        value={config.tts.providers.piper.modelPath}
        onChange={(value) => onUpdate("tts.providers.piper.modelPath", value)}
      />

      <div>
        <button className="btn-ghost text-sm" onClick={() => void onToggleDownloads()}>
          {showDownload ? "Fechar" : "Baixar nova voz"}
        </button>

        {showDownload && (
          <div className="mt-3 space-y-2">
            {availableVoices.map((voice) => {
              const isInstalled = installedFiles.some((file) => file.includes(voice.file));
              return (
                <div
                  key={voice.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: "var(--bg-void)", border: "1px solid var(--border-subtle)" }}
                >
                  <div>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{voice.name}</span>
                    {voice.desc && (
                      <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: "var(--glow-purple)" }}>
                        {voice.desc}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{voice.size}</span>
                    {isInstalled ? (
                      <span className="px-3 py-1 text-xs font-medium" style={{ color: "var(--accent-green)" }}>
                        Instalada
                      </span>
                    ) : (
                      <button className="btn-ghost px-3 py-1 text-xs" disabled={downloadingVoice !== null} onClick={() => void onInstallVoice(voice.id)}>
                        {downloadingVoice === voice.id ? `${downloadProgress?.percent ?? 0}%` : "Baixar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {downloadingVoice && downloadProgress && (
              <div className="mt-2">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${downloadProgress.percent}%` }} />
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{downloadProgress.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function ElevenLabsSection({
  config,
  voices,
  loading,
  message,
  onUpdate,
  onLoadVoices,
}: {
  config: FerroConfig;
  voices: VoiceOption[];
  loading: boolean;
  message: string;
  onUpdate: (path: string, value: unknown) => Promise<unknown>;
  onLoadVoices: (mode: "manual" | "auto") => Promise<void>;
}) {
  const selectedElevenVoiceId = config.tts.providers.elevenlabs.voiceId;

  return (
    <>
      <APIKeyInput
        label="ElevenLabs API Key"
        value={config.tts.providers.elevenlabs.apiKey}
        onChange={(value) => onUpdate("tts.providers.elevenlabs.apiKey", value)}
      />
      <div>
        <div className="mb-2 flex items-center gap-2">
          <button
            className="btn-ghost text-sm"
            disabled={loading || !config.tts.providers.elevenlabs.apiKey}
            onClick={() => void onLoadVoices("manual")}
          >
            {loading ? "Buscando..." : "Buscar vozes"}
          </button>
          {message && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {message}
            </span>
          )}
        </div>

        <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Voz ElevenLabs
        </label>
        <select
          className="select-field"
          value={selectedElevenVoiceId}
          onChange={(event) => void onUpdate("tts.providers.elevenlabs.voiceId", event.target.value)}
          disabled={loading || voices.length === 0}
        >
          {voices.length === 0 && (
            <option value="">
              {selectedElevenVoiceId ? "Restaurando voz salva..." : "Clique em \"Buscar vozes\""}
            </option>
          )}
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>{voice.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}

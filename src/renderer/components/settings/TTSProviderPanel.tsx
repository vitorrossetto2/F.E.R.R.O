import type { FerroConfig } from "../../../shared/types";
import VoiceSelector from "./VoiceSelector";
import {
  ElevenLabsSection,
  PiperSection,
  ProviderCards,
  useElevenVoices,
  usePiperDownloads,
  useTtsTest,
} from "../../features/tts-settings";
import { useEngineStore, useStartupStateStore } from "../../stores";

interface Props {
  config: FerroConfig;
  onUpdate: (path: string, value: unknown) => Promise<unknown>;
}

export default function TTSProviderPanel({ config, onUpdate }: Props) {
  const startupState = useStartupStateStore((state) => state.startupState);
  const refreshStartupState = useStartupStateStore((state) => state.refresh);
  const startEngine = useEngineStore((state) => state.start);
  const engineStatus = useEngineStore((state) => state.engine.status);
  const engineLoading = useEngineStore((state) => state.loading);

  const activeProvider = config.tts.activeProvider;
  const elevenApiKey = config.tts.providers.elevenlabs.apiKey;
  const selectedElevenVoiceId = config.tts.providers.elevenlabs.voiceId;

  const { handleTest, testResult, testing } = useTtsTest(activeProvider);
  const eleven = useElevenVoices({
    activeProvider,
    apiKey: elevenApiKey,
    selectedVoiceId: selectedElevenVoiceId,
    onSelectVoice: (voiceId) => onUpdate("tts.providers.elevenlabs.voiceId", voiceId),
  });
  const piper = usePiperDownloads({
    startupState,
    refreshStartupState,
    startEngine: async () => {
      await startEngine();
    },
    engineStatus,
    engineLoading,
  });

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
        Voz
      </h3>

      <ProviderCards activeProvider={activeProvider} onSelectProvider={(provider) => void onUpdate("tts.activeProvider", provider)} />

      <div className="card-glass space-y-4 p-5">
        {activeProvider === "piper" && (
          <PiperSection
            config={config}
            startupState={startupState}
            piperNeedsRepair={piper.piperNeedsRepair}
            voiceKey={piper.voiceKey}
            showDownload={piper.showDownload}
            availableVoices={piper.availableVoices}
            installedFiles={piper.installedFiles}
            downloadingVoice={piper.downloadingVoice}
            downloadProgress={piper.downloadProgress}
            onUpdate={onUpdate}
            onToggleDownloads={piper.toggleDownloads}
            onInstallVoice={piper.installVoice}
          />
        )}

        {activeProvider === "elevenlabs" && (
          <ElevenLabsSection
            config={config}
            voices={eleven.voices}
            loading={eleven.loading}
            message={eleven.message}
            onUpdate={onUpdate}
            onLoadVoices={eleven.loadVoices}
          />
        )}

        {activeProvider === "system" && (
          <VoiceSelector
            provider="system"
            value={config.tts.providers.system.voice}
            onChange={(value) => onUpdate("tts.providers.system.voice", value)}
          />
        )}

        <div className="flex items-center gap-3">
          <button className="btn-ghost text-sm" onClick={() => void handleTest()} disabled={testing}>
            {testing ? "Testando..." : "Testar voz"}
          </button>
          {testResult && (
            <span className="text-sm" style={{ color: testResult.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
              {testResult.message}
            </span>
          )}
        </div>
        {activeProvider === "elevenlabs" && testResult && !testResult.ok && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Dica: confirme a API Key, clique em "Buscar vozes" e selecione uma voz válida antes de testar.
          </p>
        )}
      </div>
    </section>
  );
}

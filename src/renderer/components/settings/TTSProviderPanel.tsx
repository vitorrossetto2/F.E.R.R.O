import { useState } from "react";
import type { MicaConfig, TTSProviderType, PiperVoiceOption, PiperProgress } from "../../../shared/types.js";
import APIKeyInput from "./APIKeyInput.js";
import VoiceSelector from "./VoiceSelector.js";

const PROVIDERS: { id: TTSProviderType; name: string; desc: string; badge: string }[] = [
  { id: "piper", name: "Piper", desc: "Local, rápido, PT-BR", badge: "Gratuito" },
  { id: "elevenlabs", name: "ElevenLabs", desc: "Voz natural na nuvem", badge: "Pago" },
  { id: "system", name: "Sistema", desc: "Voz do Windows", badge: "Gratuito" },
];

interface Props {
  config: MicaConfig;
  onUpdate: (path: string, value: unknown) => Promise<void>;
}

export default function TTSProviderPanel({ config, onUpdate }: Props) {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<PiperVoiceOption[]>([]);
  const [installedFiles, setInstalledFiles] = useState<string[]>([]);
  const [downloadingVoice, setDownloadingVoice] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<PiperProgress | null>(null);
  const [voiceKey, setVoiceKey] = useState(0); // force VoiceSelector refresh

  const active = config.tts.activeProvider;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Escrito errado, fonética correta.
      const result = (await window.micaAPI.testTTS(active, "Olá, sou Mica EIAI, seu assistente de Ligue of Lehgends.")) as { ok: boolean; error?: string };
      setTestResult({ ok: result.ok, message: result.ok ? "Voz tocada!" : result.error || "Erro" });
    } catch {
      setTestResult({ ok: false, message: "Erro ao testar" });
    }
    setTesting(false);
  };

  return (
    <section className="space-y-4">
      <h3
        className="text-lg font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
      >
        Voz
      </h3>

      {/* Provider selection */}
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => onUpdate("tts.activeProvider", p.id)}
            className="card-glass px-3 py-3 text-left"
            style={{
              borderColor: active === p.id ? "var(--glow-purple)" : undefined,
              boxShadow: active === p.id ? "0 0 12px rgba(124, 91, 245, 0.12)" : undefined,
              cursor: "pointer",
              background: active === p.id ? "var(--bg-elevated)" : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: active === p.id ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {p.name}
              </p>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: p.badge === "Gratuito" ? "rgba(52, 211, 153, 0.12)" : "rgba(245, 166, 35, 0.12)",
                  color: p.badge === "Gratuito" ? "var(--accent-green)" : "var(--accent-orange)",
                }}
              >
                {p.badge}
              </span>
            </div>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {p.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Provider config */}
      <div className="card-glass space-y-4 p-5">
        {active === "piper" && (
          <>
            <VoiceSelector
              key={voiceKey}
              provider="piper"
              value={config.tts.providers.piper.modelPath}
              onChange={(v) => onUpdate("tts.providers.piper.modelPath", v)}
            />
            <div>
              <button
                className="btn-ghost text-sm"
                onClick={async () => {
                  if (!showDownload) {
                    const [voices, installed] = await Promise.all([
                      window.micaAPI.getAvailablePiperVoices() as Promise<PiperVoiceOption[]>,
                      window.micaAPI.listPiperVoices() as Promise<{ id: string; name: string }[]>,
                    ]);
                    setAvailableVoices(voices);
                    setInstalledFiles(installed.map((v) => v.id));
                  }
                  setShowDownload(!showDownload);
                }}
              >
                {showDownload ? "Fechar" : "Baixar nova voz"}
              </button>

              {showDownload && (
                <div className="mt-3 space-y-2">
                  {availableVoices.map((v) => {
                    const isInstalled = installedFiles.some((f) => f.includes(v.file));
                    return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: "var(--bg-void)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{v.name}</span>
                        {v.desc && (
                          <span className="ml-2 text-[10px] font-semibold uppercase" style={{ color: "var(--glow-purple)" }}>
                            {v.desc}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{v.size}</span>
                        {isInstalled ? (
                          <span className="px-3 py-1 text-xs font-medium" style={{ color: "var(--accent-green)" }}>
                            Instalada
                          </span>
                        ) : (
                        <button
                          className="btn-ghost px-3 py-1 text-xs"
                          disabled={downloadingVoice !== null}
                          onClick={async () => {
                            setDownloadingVoice(v.id);
                            setDownloadProgress(null);
                            const unsub = window.micaAPI.onPiperProgress((p) => {
                              const prog = p as PiperProgress;
                              setDownloadProgress(prog);
                              if (prog.stage === "done" || prog.stage === "error") {
                                setDownloadingVoice(null);
                                if (prog.stage === "done") {
                                  setShowDownload(false);
                                  setVoiceKey((k) => k + 1);
                                }
                                unsub();
                              }
                            });
                            await window.micaAPI.installPiper(v.id);
                          }}
                        >
                          {downloadingVoice === v.id ? `${downloadProgress?.percent ?? 0}%` : "Baixar"}
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
        )}

        {active === "elevenlabs" && (
          <>
            <APIKeyInput
              label="ElevenLabs API Key"
              value={config.tts.providers.elevenlabs.apiKey}
              onChange={(v) => onUpdate("tts.providers.elevenlabs.apiKey", v)}
            />
            <VoiceSelector
              provider="elevenlabs"
              apiKey={config.tts.providers.elevenlabs.apiKey}
              value={config.tts.providers.elevenlabs.voiceId}
              onChange={(v) => onUpdate("tts.providers.elevenlabs.voiceId", v)}
            />
          </>
        )}

        {active === "system" && (
          <VoiceSelector
            provider="system"
            value={config.tts.providers.system.voice}
            onChange={(v) => onUpdate("tts.providers.system.voice", v)}
          />
        )}

        <div className="flex items-center gap-3">
          <button className="btn-ghost text-sm" onClick={handleTest} disabled={testing}>
            {testing ? "Testando..." : "Testar voz"}
          </button>
          {testResult && (
            <span className="text-sm" style={{ color: testResult.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
              {testResult.message}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

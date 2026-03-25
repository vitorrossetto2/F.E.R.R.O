import { useState, useEffect } from "react";
import type { PiperProgress, PiperVoiceOption } from "../../shared/types.js";

interface Props {
  onComplete: () => void;
}

export default function PiperSetup({ onComplete }: Props) {
  const [voices, setVoices] = useState<PiperVoiceOption[]>([]);
  const [selected, setSelected] = useState("faber-medium");
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<PiperProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.micaAPI.getAvailablePiperVoices().then((v) => setVoices(v as PiperVoiceOption[]));
    const unsub = window.micaAPI.onPiperProgress((data) => {
      const p = data as PiperProgress;
      setProgress(p);
      if (p.stage === "done") {
        setTimeout(onComplete, 800);
      }
      if (p.stage === "error") {
        setError(p.message);
        setInstalling(false);
      }
    });
    return unsub;
  }, [onComplete]);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    const result = await window.micaAPI.installPiper(selected) as { ok: boolean; error?: string };
    if (!result.ok && result.error) {
      setError(result.error);
      setInstalling(false);
    }
  };

  const handleSkip = async () => {
    await window.micaAPI.setConfig("tts.activeProvider", "system");
    onComplete();
  };

  return (
    <div
      className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      {/* Glow effects */}
      <div
        className="glow-orb glow-orb-purple"
        style={{ width: 500, height: 500, top: "15%", left: "calc(50% - 250px)", animation: "pulseGlow 4s ease-in-out infinite" }}
      />
      <div
        className="glow-orb glow-orb-blue"
        style={{ width: 300, height: 300, top: "25%", left: "calc(50% + 50px)", animation: "pulseGlow 5s ease-in-out infinite 1.5s" }}
      />

      <div className="animate-in relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Logo */}
        <div
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(135deg, var(--glow-purple), var(--glow-blue))",
            color: "white",
            boxShadow: "0 0 40px rgba(124, 91, 245, 0.3)",
          }}
        >
          M
        </div>

        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          F.E.R.R.O Coach
        </h1>

        <p className="mt-3 text-base" style={{ color: "var(--text-secondary)" }}>
          Para começar, instale o Piper TTS
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Motor de voz local, gratuito e rápido
        </p>

        {/* Voice selection */}
        <div className="mt-8 w-full space-y-2">
          {voices.map((voice) => (
            <label
              key={voice.id}
              className="card-glass flex cursor-pointer items-center gap-3 px-4 py-3"
              style={{
                borderColor: selected === voice.id ? "var(--glow-purple)" : undefined,
                boxShadow: selected === voice.id ? "0 0 12px rgba(124, 91, 245, 0.15)" : undefined,
              }}
            >
              <input
                type="radio"
                name="voice"
                value={voice.id}
                checked={selected === voice.id}
                onChange={() => setSelected(voice.id)}
                className="sr-only"
              />
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: selected === voice.id ? "var(--glow-purple)" : "var(--text-muted)" }}
              >
                {selected === voice.id && (
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--glow-purple)" }} />
                )}
              </span>
              <span className="flex-1 text-left">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {voice.name}
                </span>
                {voice.desc && (
                  <span
                    className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ background: "rgba(124, 91, 245, 0.15)", color: "var(--glow-purple)" }}
                  >
                    {voice.desc}
                  </span>
                )}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {voice.size}
              </span>
            </label>
          ))}
        </div>

        {/* Progress bar */}
        {installing && progress && progress.stage !== "done" && progress.stage !== "error" && (
          <div className="mt-6 w-full">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              {progress.message}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm" style={{ color: "var(--accent-red)" }}>
            {error}
          </p>
        )}

        {/* Install button */}
        {!installing && (
          <button className="btn-primary mt-8 w-full text-base" onClick={handleInstall}>
            Instalar Piper
          </button>
        )}

        {installing && progress?.stage === "done" && (
          <p className="mt-6 text-sm font-medium" style={{ color: "var(--accent-green)" }}>
            Instalado com sucesso!
          </p>
        )}

        {/* Skip link */}
        <button
          onClick={handleSkip}
          className="mt-5 text-sm"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          Pular e usar voz do sistema
        </button>
      </div>
    </div>
  );
}

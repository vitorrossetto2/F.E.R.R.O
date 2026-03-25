import { useState, useEffect } from "react";
import type { PiperProgress, PiperVoiceOption } from "../../shared/types.js";

interface Props {
  onComplete: () => void;
}

type SetupStep = "intro" | "install";

const FEATURE_CARDS = [
  {
    title: "Coaching em tempo real",
    description: "O FERRO acompanha sua partida e fala o que importa no momento certo, sem voce tirar o foco do jogo.",
  },
  {
    title: "Voz local e rapida",
    description: "O Piper roda no seu PC com baixa latencia, deixando a fala pronta mesmo sem depender da internet.",
  },
  {
    title: "Tudo ajustavel depois",
    description: "Depois do inicio voce pode trocar voz, mudar provider e refinar o comportamento nas configuracoes.",
  },
];

export default function PiperSetup({ onComplete }: Props) {
  const [step, setStep] = useState<SetupStep>("intro");
  const [voices, setVoices] = useState<PiperVoiceOption[]>([]);
  const [selected, setSelected] = useState("faber-medium");
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<PiperProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.ferroAPI.getAvailablePiperVoices().then((v) => setVoices(v as PiperVoiceOption[]));
    const unsub = window.ferroAPI.onPiperProgress((data) => {
      const p = data as PiperProgress;
      setProgress(p);
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
    const result = (await window.ferroAPI.installPiper(selected)) as { ok: boolean; error?: string };
    if (result.ok) {
      await window.ferroAPI.completeOnboarding();
      setTimeout(onComplete, 800);
      return;
    }
    if (result.error) {
      setError(result.error);
      setInstalling(false);
    }
  };

  return (
    <div
      className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      <div
        className="glow-orb glow-orb-purple"
        style={{ width: 520, height: 520, top: "12%", left: "calc(50% - 280px)", animation: "pulseGlow 4s ease-in-out infinite" }}
      />
      <div
        className="glow-orb glow-orb-blue"
        style={{ width: 340, height: 340, top: "24%", left: "calc(50% + 40px)", animation: "pulseGlow 5s ease-in-out infinite 1.3s" }}
      />
      <div
        className="glow-orb glow-orb-purple"
        style={{ width: 220, height: 220, bottom: "-40px", left: "calc(50% - 360px)", opacity: 0.45 }}
      />

      <div className="animate-in relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center">
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
          className="text-4xl font-bold tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          F.E.R.R.O Coach
        </h1>

        {step === "intro" && (
          <>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Um assistente de voz para acompanhar sua partida, dar chamadas uteis e deixar o coaching sempre presente
              sem poluir sua tela.
            </p>

            <div className="mt-10 grid w-full max-w-4xl gap-4 md:grid-cols-3">
              {FEATURE_CARDS.map((card, index) => (
                <div
                  key={card.title}
                  className="card-glass rounded-2xl p-5 text-left"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                    animation: `fadeSlideUp 420ms ease-out ${index * 90}ms both`,
                  }}
                >
                  <div
                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                    style={{
                      background: "linear-gradient(135deg, rgba(124, 91, 245, 0.25), rgba(56, 189, 248, 0.18))",
                      color: "var(--text-primary)",
                    }}
                  >
                    {index + 1}
                  </div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {card.description}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="mt-8 max-w-2xl rounded-2xl px-5 py-4"
              style={{ background: "rgba(124, 91, 245, 0.08)", border: "1px solid rgba(124, 91, 245, 0.18)" }}
            >
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Para entrar no sistema, o proximo passo e configurar o Piper. Ele sera a voz local padrao do app e
                deixa tudo pronto para o FERRO falar assim que voce terminar esta etapa.
              </p>
            </div>

            <button className="btn-primary mt-8 min-w-72 text-base" onClick={() => setStep("install")}>
              Configurar Piper
            </button>
          </>
        )}

        {step === "install" && (
          <>
            <p className="mt-4 text-base" style={{ color: "var(--text-secondary)" }}>
              Escolha a voz inicial e instale o Piper para finalizar sua configuracao.
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Motor de voz local, gratuito e rapido
            </p>

            <div className="mt-8 w-full max-w-xl space-y-2">
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

            {installing && progress && progress.stage !== "done" && progress.stage !== "error" && (
              <div className="mt-6 w-full max-w-xl">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {progress.message}
                </p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm" style={{ color: "var(--accent-red)" }}>
                {error}
              </p>
            )}

            <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              {!installing && (
                <button className="btn-primary flex-1 text-base" onClick={handleInstall}>
                  Instalar Piper
                </button>
              )}
              {!installing && (
                <button
                  className="btn-ghost flex-1 text-base"
                  onClick={() => {
                    setError(null);
                    setStep("intro");
                  }}
                >
                  Voltar
                </button>
              )}
            </div>

            {installing && progress?.stage === "done" && (
              <p className="mt-6 text-sm font-medium" style={{ color: "var(--accent-green)" }}>
                Instalado com sucesso!
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { FerroConfig, LLMProviderType } from "../../../shared/types.js";
import APIKeyInput from "./APIKeyInput.js";
import ModelSelector from "./ModelSelector.js";

const PROVIDERS: { id: LLMProviderType; name: string; desc: string }[] = [
  { id: "none", name: "Sem LLM", desc: "Apenas heurísticas (sem custo)" },
  { id: "zai", name: "Z.AI", desc: "GLM-5 via Z.ai" },
  { id: "openai", name: "OpenAI", desc: "GPT / o-series" },
  { id: "gemini", name: "Gemini", desc: "Google AI" },
];

interface Props {
  config: FerroConfig;
  onUpdate: (path: string, value: unknown) => Promise<void>;
}

export default function LLMProviderPanel({ config, onUpdate }: Props) {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const active = config.llm.activeProvider;

  const handleTest = async () => {
    if (active === "none") return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = (await window.ferroAPI.testLLM(active)) as { ok: boolean; ms?: number; error?: string };
      setTestResult({
        ok: result.ok,
        message: result.ok ? `Conectado (${result.ms}ms)` : result.error || "Erro",
      });
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
        Inteligência Artificial
      </h3>

      {/* Provider selection */}
      <div className="grid grid-cols-4 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => onUpdate("llm.activeProvider", p.id)}
            className="card-glass px-3 py-3 text-left"
            style={{
              borderColor: active === p.id ? "var(--glow-purple)" : undefined,
              boxShadow: active === p.id ? "0 0 12px rgba(124, 91, 245, 0.12)" : undefined,
              cursor: "pointer",
              background: active === p.id ? "var(--bg-elevated)" : undefined,
            }}
          >
            <p className="text-sm font-medium" style={{ color: active === p.id ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {p.name}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {p.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Provider config */}
      {active !== "none" && (
        <div className="card-glass space-y-4 p-5">
          <APIKeyInput
            label="API Key"
            value={config.llm.providers[active].apiKey}
            onChange={(v) => onUpdate(`llm.providers.${active}.apiKey`, v)}
          />
          <ModelSelector
            provider={active}
            value={config.llm.providers[active].model}
            onChange={(v) => onUpdate(`llm.providers.${active}.model`, v)}
          />
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost text-sm"
              onClick={handleTest}
              disabled={testing || !config.llm.providers[active].apiKey}
            >
              {testing ? "Testando..." : "Testar conexão"}
            </button>
            {testResult && (
              <span className="text-sm" style={{ color: testResult.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

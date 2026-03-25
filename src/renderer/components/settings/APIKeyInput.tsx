import { useState } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function APIKeyInput({ label, value, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--text-muted)]">{label}</label>
      <div className="flex gap-2">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-teal)]"
        />
        <button
          onClick={() => setVisible(!visible)}
          className="rounded-lg bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-panel-hover)]"
          title={visible ? "Ocultar" : "Mostrar"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}

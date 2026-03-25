import type { TabId } from "../../App.js";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "match", label: "Partida" },
  { id: "messages", label: "Mensagens" },
  { id: "settings", label: "Configurações" },
];

export default function TabBar({ activeTab, onTabChange }: Props) {
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative px-4 py-2 text-sm font-medium transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            {tab.label}
            {active && (
              <span
                className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--glow-purple), var(--glow-blue))",
                  boxShadow: "0 0 8px rgba(124, 91, 245, 0.5)",
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

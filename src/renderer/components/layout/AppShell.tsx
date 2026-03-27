import type { ReactNode } from "react";
import type { TabId } from "../../App";
import TabBar from "./TabBar";
import PoweredByBadge from "./PoweredByBadge";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  notice?: ReactNode;
  children: ReactNode;
}

export default function AppShell({ activeTab, onTabChange, notice, children }: Props) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "var(--bg-void)" }}>
      {/* Top navigation bar */}
      <header
        className="flex h-14 shrink-0 items-center justify-between px-6"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, var(--glow-purple), var(--glow-blue))",
              color: "white",
            }}
          >
            M
          </div>
          <span
            className="text-sm font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            F.E.R.R.O
          </span>
        </div>

        {/* Tabs */}
        <TabBar activeTab={activeTab} onTabChange={onTabChange} />

        {/* Version */}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          v0.1.0
        </span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {notice}
          {children}
        </div>
      </main>

      <PoweredByBadge />
    </div>
  );
}

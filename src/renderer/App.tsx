import { useState, useEffect } from "react";
import AppShell from "./components/layout/AppShell.js";
import Dashboard from "./pages/Dashboard.js";
import MatchAnalysis from "./pages/MatchAnalysis.js";
import Messages from "./pages/Messages.js";
import Settings from "./pages/Settings.js";
import PiperSetup from "./pages/PiperSetup.js";

export type TabId = "dashboard" | "match" | "messages" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [showSetup, setShowSetup] = useState<boolean | null>(null);

  useEffect(() => {
    window.micaAPI.checkPiper().then((status: { installed: boolean }) => {
      setShowSetup(!status.installed);
    });
  }, []);

  // Loading state
  if (showSetup === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: "var(--bg-void)" }}>
        <div className="glow-orb glow-orb-purple" style={{ width: 300, height: 300, top: "30%", left: "40%" }} />
      </div>
    );
  }

  // First-run Piper setup
  if (showSetup) {
    return (
      <PiperSetup
        onComplete={() => {
          setShowSetup(false);
          window.micaAPI.startEngine();
        }}
      />
    );
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "dashboard" && <Dashboard />}
      {activeTab === "match" && <MatchAnalysis />}
      {activeTab === "messages" && <Messages />}
      {activeTab === "settings" && <Settings />}
    </AppShell>
  );
}

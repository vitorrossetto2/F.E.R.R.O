import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PiperProgress,
  PiperVoiceOption,
  StartupState,
  TTSProviderType,
  VoiceOption,
} from "../../../shared/types";
import {
  cacheElevenVoices,
  friendlyTtsError,
  getCachedElevenVoices,
  getElevenCacheKey,
} from "./helpers";

export function useTtsTest(activeProvider: TTSProviderType) {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.ferroAPI.testTTS(
        activeProvider,
        "OlÃ¡, sou FERRO EIAI, seu assistente de Ligue of Lehgends."
      ) as { ok: boolean; error?: string };
      setTestResult({
        ok: result.ok,
        message: result.ok ? "Voz tocada!" : friendlyTtsError(activeProvider, result.error),
      });
    } catch {
      setTestResult({ ok: false, message: "Erro ao testar" });
    }
    setTesting(false);
  };

  return { handleTest, testResult, testing };
}

export function useElevenVoices({
  activeProvider,
  apiKey,
  selectedVoiceId,
  onSelectVoice,
}: {
  activeProvider: TTSProviderType;
  apiKey: string;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => Promise<unknown>;
}) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const attemptedAutoLoadKeys = useRef<Set<string>>(new Set());
  const cacheKey = useMemo(() => getElevenCacheKey(apiKey), [apiKey]);

  const loadVoices = async (mode: "manual" | "auto") => {
    if (!cacheKey) {
      setVoices([]);
      setMessage("Informe sua API Key para carregar as vozes.");
      return;
    }

    setLoading(true);
    if (mode === "manual") {
      setMessage("");
    }

    try {
      const nextVoices = await window.ferroAPI.listElevenLabsVoices(cacheKey) as VoiceOption[];
      cacheElevenVoices(cacheKey, nextVoices);
      setVoices(nextVoices);
      if (nextVoices.length === 0) {
        setMessage("Nenhuma voz retornada pela API.");
      } else {
        setMessage(mode === "manual" ? `${nextVoices.length} voz(es) carregada(s).` : `${nextVoices.length} voz(es) restaurada(s).`);
        const hasSelected = nextVoices.some((voice) => voice.id === selectedVoiceId);
        if (!hasSelected) {
          await onSelectVoice(nextVoices[0].id);
        }
      }
    } catch {
      setVoices([]);
      setMessage(mode === "manual" ? "Erro ao buscar vozes no ElevenLabs." : "Nao foi possivel restaurar as vozes do ElevenLabs.");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (activeProvider !== "elevenlabs") return;
    if (!cacheKey) {
      setVoices([]);
      return;
    }

    const cachedVoices = getCachedElevenVoices(cacheKey);
    if (cachedVoices.length > 0) {
      setVoices(cachedVoices);
      if (!message) {
        setMessage(`${cachedVoices.length} voz(es) em cache.`);
      }
      return;
    }

    if (selectedVoiceId && !attemptedAutoLoadKeys.current.has(cacheKey)) {
      attemptedAutoLoadKeys.current.add(cacheKey);
      void loadVoices("auto");
    }
  }, [activeProvider, cacheKey, message, selectedVoiceId]);

  return {
    cacheKey,
    loadVoices,
    loading,
    message,
    setMessage,
    voices,
  };
}

export function usePiperDownloads({
  startupState,
  refreshStartupState,
  startEngine,
  engineStatus,
  engineLoading,
}: {
  startupState: StartupState | null;
  refreshStartupState: () => Promise<StartupState | null>;
  startEngine: () => Promise<unknown>;
  engineStatus: string;
  engineLoading: boolean;
}) {
  const [showDownload, setShowDownload] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<PiperVoiceOption[]>([]);
  const [installedFiles, setInstalledFiles] = useState<string[]>([]);
  const [downloadingVoice, setDownloadingVoice] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<PiperProgress | null>(null);
  const [voiceKey, setVoiceKey] = useState(0);

  const piperNeedsRepair = Boolean(
    startupState &&
    startupState.activeTtsProvider === "piper" &&
    (!startupState.piperBinaryInstalled || !startupState.piperModelConfigured || !startupState.piperModelExists)
  );

  const toggleDownloads = async () => {
    if (!showDownload) {
      const [voices, installed] = await Promise.all([
        window.ferroAPI.getAvailablePiperVoices() as Promise<PiperVoiceOption[]>,
        window.ferroAPI.listPiperVoices() as Promise<{ id: string; name: string }[]>,
      ]);
      setAvailableVoices(voices);
      setInstalledFiles(installed.map((voice) => voice.id));
    }

    setShowDownload(!showDownload);
  };

  const installVoice = async (voiceId: string) => {
    setDownloadingVoice(voiceId);
    setDownloadProgress(null);
    const unsub = window.ferroAPI.onPiperProgress((progress) => {
      const next = progress as PiperProgress;
      setDownloadProgress(next);
      if (next.stage === "done" || next.stage === "error") {
        setDownloadingVoice(null);
        if (next.stage === "done") {
          setShowDownload(false);
          setVoiceKey((value) => value + 1);
        }
        unsub();
      }
    });

    const result = await window.ferroAPI.installPiper(voiceId) as { ok: boolean };
    if (result.ok) {
      const nextStartupState = await refreshStartupState();
      if (nextStartupState?.engineAutoStartAllowed && !engineLoading && (engineStatus === "idle" || engineStatus === "error")) {
        await startEngine();
      }
    }
  };

  return {
    availableVoices,
    downloadProgress,
    downloadingVoice,
    installVoice,
    installedFiles,
    piperNeedsRepair,
    setVoiceKey,
    showDownload,
    toggleDownloads,
    voiceKey,
  };
}

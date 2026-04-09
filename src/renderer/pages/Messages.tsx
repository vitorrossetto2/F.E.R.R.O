import type { MessageCategoryConfig } from "../../shared/types";
import {
  getResolvedMessages,
  MESSAGE_MODE_OPTIONS,
  MessagesContent,
} from "../features/messages";
import type { MessageCategoryId } from "../features/messages";
import { useConfigStore, useElevenLabsUsageSummaryStore } from "../stores";

export { MESSAGE_MODE_OPTIONS, MessagesContent } from "../features/messages";

export default function Messages() {
  const config = useConfigStore((state) => state.config);
  const loading = useConfigStore((state) => state.loading);
  const updateConfig = useConfigStore((state) => state.update);
  const elevenLabsUsageSummary = useElevenLabsUsageSummaryStore((state) => state.summary);
  const usageLoading = useElevenLabsUsageSummaryStore((state) => state.loading);

  if ((loading && !config) || (usageLoading && !elevenLabsUsageSummary) || !config) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Carregando...</p>
      </div>
    );
  }

  const messages = getResolvedMessages(config.messages);

  const updateMessages = async (nextMessages: Record<MessageCategoryId, MessageCategoryConfig>) => {
    const mergedMessages = {
      ...config.messages,
      ...nextMessages,
    };

    await updateConfig("messages", mergedMessages);
  };

  const toggle = async (id: MessageCategoryId) => {
    await updateMessages({
      ...messages,
      [id]: {
        ...messages[id],
        enabled: !messages[id].enabled,
      },
    });
  };

  const setCooldown = async (id: MessageCategoryId, value: number) => {
    const nextValue = Math.min(600, Math.max(5, value));
    await updateMessages({
      ...messages,
      [id]: {
        ...messages[id],
        cooldownSeconds: nextValue,
      },
    });
  };

  const setMessageMode = async (mode: typeof MESSAGE_MODE_OPTIONS[number]["id"]) => {
    await updateConfig("coach.messageMode", mode);
  };

  const applyPreset = async (presetMessages: Record<MessageCategoryId, MessageCategoryConfig>) => {
    await updateMessages(presetMessages);
  };

  return (
    <MessagesContent
      config={config}
      messages={messages}
      elevenLabsUsageSummary={elevenLabsUsageSummary}
      onToggle={toggle}
      onSetCooldown={setCooldown}
      onSetMessageMode={setMessageMode}
      onApplyPreset={applyPreset}
    />
  );
}

import OpenAI from "openai";

export type LLMTransport = "chat" | "responses";

export interface LLMTextMessage {
  role: string;
  content: string;
}

export interface LLMTextRequest {
  apiKey: string;
  endpoint: string;
  model: string;
  messages: LLMTextMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  chatRequest?: Record<string, unknown>;
  responseRequest?: Record<string, unknown>;
}

export interface LLMTextResult {
  text: string;
  usage: unknown;
  transport: LLMTransport;
  raw: unknown;
}

export function normalizeLlmBaseUrl(endpoint: string): string {
  return endpoint.replace(/\/(?:chat\/completions|responses)\/?$/, "");
}

export function resolveLlmTransport(endpoint: string): LLMTransport {
  const normalized = endpoint.trim().toLowerCase();
  return normalized.endsWith("/responses") || normalized.endsWith("/responses/") ? "responses" : "chat";
}

export function createLlmClient(apiKey: string, endpoint: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: normalizeLlmBaseUrl(endpoint)
  });
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";

  const item = content as Record<string, unknown>;
  if (typeof item.text === "string") return item.text;
  if (typeof item.content === "string") return item.content;
  return "";
}

function extractChatText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";

  const response = raw as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  const firstChoice = response.choices?.[0];
  const content = firstChoice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(extractContentText).join("");
  }
  return extractContentText(content);
}

function extractResponseText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";

  const response = raw as {
    output_text?: unknown;
    output?: Array<{ type?: string; content?: unknown }>;
  };

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (!item || typeof item !== "object") continue;
    const content = item.content;
    if (typeof content === "string") {
      parts.push(content);
      continue;
    }
    if (Array.isArray(content)) {
      for (const entry of content) {
        const text = extractContentText(entry);
        if (text) parts.push(text);
      }
      continue;
    }

    const text = extractContentText(content);
    if (text) parts.push(text);
  }

  return parts.join("");
}

export function extractLlmText(raw: unknown, transport: LLMTransport): string {
  return transport === "responses" ? extractResponseText(raw) : extractChatText(raw);
}

export async function runLlmTextRequest(request: LLMTextRequest): Promise<LLMTextResult> {
  const transport = resolveLlmTransport(request.endpoint);
  const client = createLlmClient(request.apiKey, request.endpoint) as any;

  const body =
    transport === "responses"
      ? {
          model: request.model,
          input: request.messages,
          temperature: request.temperature,
          max_output_tokens: request.maxOutputTokens,
          ...(request.responseRequest ?? {})
        }
      : {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxOutputTokens,
          ...(request.chatRequest ?? {})
        };

  const raw =
    transport === "responses"
      ? await client.responses.create(body)
      : await client.chat.completions.create(body);

  return {
    text: extractLlmText(raw, transport).trim(),
    usage: (raw as { usage?: unknown }).usage ?? null,
    transport,
    raw
  };
}

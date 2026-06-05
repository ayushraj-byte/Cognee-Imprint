import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Memory, Topic } from "./dynamodb";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// claude-3-5-sonnet on Bedrock
const MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";

interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Core invoke ──────────────────────────────────────────

async function invokeClaudeJson<T>(
  systemPrompt: string,
  userMessage: string,
  apiKey?: string
): Promise<T> {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await bedrock.send(command);
  const decoded = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(decoded);
  const text = parsed.content[0].text;

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned) as T;
}

// ── Memory extraction ────────────────────────────────────

interface ExtractedMemory {
  content: string;
  topic: Topic;
  keywords: string[];
  confidence: number;
}

export async function extractMemories(
  conversation: BedrockMessage[]
): Promise<ExtractedMemory[]> {
  const conversationText = conversation
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const system = `You are a memory extraction system. Extract factual, personal information about the USER from conversations.
Only extract concrete facts (not opinions, not questions, not hypotheticals).
Topics: work, personal, preferences, health, projects, relationships, general.
Return JSON array of memories.`;

  const prompt = `Extract memorable facts from this conversation. Return ONLY valid JSON array:
[
  {
    "content": "User is a software engineer at Google",
    "topic": "work",
    "keywords": ["software engineer", "google", "job"],
    "confidence": 0.95
  }
]

Conversation:
${conversationText}

Return empty array [] if no memorable facts found. Return ONLY JSON, no explanation.`;

  try {
    return await invokeClaudeJson<ExtractedMemory[]>(system, prompt);
  } catch {
    return [];
  }
}

// ── Contradiction detection ──────────────────────────────

interface ContradictionResult {
  hasContradiction: boolean;
  contradictions: Array<{
    newMemoryContent: string;
    existingMemoryId: string;
    existingMemoryContent: string;
    explanation: string;
  }>;
}

export async function detectContradictions(
  newMemories: ExtractedMemory[],
  existingMemories: Memory[]
): Promise<ContradictionResult> {
  if (!newMemories.length || !existingMemories.length) {
    return { hasContradiction: false, contradictions: [] };
  }

  const system = `You are a contradiction detection system. Find direct factual contradictions between new and existing memories about the same person.
Only flag CLEAR contradictions (e.g., "lives in NYC" vs "lives in London"), not updates or additions.
Return JSON only.`;

  const prompt = `Find contradictions between NEW memories and EXISTING memories.

NEW MEMORIES:
${newMemories.map((m, i) => `${i}. "${m.content}"`).join("\n")}

EXISTING MEMORIES (with IDs):
${existingMemories.map((m) => `ID:${m.memoryId} "${m.content}"`).join("\n")}

Return ONLY valid JSON:
{
  "hasContradiction": true,
  "contradictions": [
    {
      "newMemoryContent": "...",
      "existingMemoryId": "...",
      "existingMemoryContent": "...",
      "explanation": "User said X before but now says Y"
    }
  ]
}`;

  try {
    return await invokeClaudeJson<ContradictionResult>(system, prompt);
  } catch {
    return { hasContradiction: false, contradictions: [] };
  }
}

// ── Topic classification ─────────────────────────────────

export async function classifyTopic(content: string): Promise<Topic> {
  const topics: Topic[] = [
    "work",
    "personal",
    "preferences",
    "health",
    "projects",
    "relationships",
    "general",
  ];

  const system = `Classify text into one topic. Return ONLY the topic word.`;
  const prompt = `Classify: "${content}"\nTopics: ${topics.join(", ")}\nReturn ONLY one word.`;

  try {
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 20,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body,
      })
    );

    const decoded = new TextDecoder().decode(response.body);
    const parsed = JSON.parse(decoded);
    const topic = parsed.content[0].text.trim().toLowerCase() as Topic;
    return topics.includes(topic) ? topic : "general";
  } catch {
    return "general";
  }
}

// ── Chat with memory injection (streaming) ───────────────

export async function* chatWithMemory(
  messages: BedrockMessage[],
  relevantMemories: Memory[],
  userApiKey?: string
): AsyncGenerator<string> {
  const memoryContext =
    relevantMemories.length > 0
      ? `\n\nYou remember these facts about the user from past conversations:\n${relevantMemories
          .map((m) => `- [${m.topic}] ${m.content}`)
          .join("\n")}\n\nUse these memories naturally — don't explicitly say "I remember you told me", just know it.`
      : "";

  const system = `You are Claude, a helpful AI assistant with persistent memory.${memoryContext}`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2048,
    system,
    messages,
  });

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await bedrock.send(command);

  for await (const event of response.body!) {
    if (event.chunk?.bytes) {
      const decoded = new TextDecoder().decode(event.chunk.bytes);
      const parsed = JSON.parse(decoded);
      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        yield parsed.delta.text;
      }
    }
  }
}

// ── Memory import from raw text ──────────────────────────

export async function importMemoriesFromText(
  text: string
): Promise<ExtractedMemory[]> {
  const system = `Extract personal facts from text. Same format as memory extraction.`;
  const prompt = `Extract memorable facts from this text. Return ONLY valid JSON array:
[{"content": "...", "topic": "...", "keywords": [...], "confidence": 0.9}]

Text:
${text}

Return ONLY JSON, no explanation.`;

  try {
    return await invokeClaudeJson<ExtractedMemory[]>(system, prompt);
  } catch {
    return [];
  }
}

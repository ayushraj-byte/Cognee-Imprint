/**
 * Smart memory extraction using Groq (free tier — llama-3.3-70b).
 * Falls back to regex patterns if Groq is unavailable or key not set.
 */

export type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";

export interface ExtractedMemory {
  content: string;
  topic: Topic;
  keywords: string[];
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────
// GROQ extraction — understands implicit/contextual facts
// ─────────────────────────────────────────────────────────────────

const GROQ_SYSTEM = `You are a memory extraction system. Given a conversation, extract factual statements about the USER (not the assistant).

Rules:
- Only extract facts about the USER's life, preferences, work, projects, goals, tech stack, relationships, health
- Extract IMPLICIT facts too (e.g. "my app keeps crashing" → user has an app; "we shipped last week" → user is on a team that ships)
- Ignore opinions about general topics, questions, and assistant's text
- Each fact must be a complete, standalone sentence (someone reading it with no context should understand it)
- Max 8 facts per extraction
- DO NOT extract what the user asked Claude — extract facts ABOUT the user

Return a JSON array ONLY, no other text:
[
  { "content": "User is building X", "topic": "projects", "keywords": ["x", "building"], "confidence": 0.9 },
  ...
]

Topics: work | personal | preferences | projects | health | relationships | general`;

export async function extractWithGroq(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<ExtractedMemory[]> {
  const userText = messages
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: GROQ_SYSTEM },
        { role: "user", content: `Extract memories from this conversation:\n\n${userText.slice(0, 6000)}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "[]";

  // Groq returns json_object, so content might be { memories: [...] } or [...]
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.memories || parsed.facts || Object.values(parsed)[0] || []);

  return arr
    .filter((m: any) => m.content && m.topic)
    .map((m: any) => ({
      content: String(m.content).trim(),
      topic: (m.topic || "general") as Topic,
      keywords: Array.isArray(m.keywords) ? m.keywords : String(m.content).toLowerCase().split(/\s+/).slice(0, 5),
      confidence: Number(m.confidence) || 0.8,
    }))
    .filter(m => m.content.length > 10);
}

// ─────────────────────────────────────────────────────────────────
// Regex fallback — catches structured statements when Groq unavailable
// ─────────────────────────────────────────────────────────────────

const PATTERNS: { re: RegExp; topic: Topic; tpl: (m: RegExpExecArray) => string }[] = [
  // Identity
  { re: /(?:my name is|i(?:'m| am) called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,      topic: "personal",     tpl: m => `User's name is ${m[1]}` },
  { re: /(?:i(?:'m| am) (?:from|in|based in)|i live in)\s+([A-Za-z\s,]+?)(?:\.|,|$)/gi, topic: "personal",     tpl: m => `User is from/in ${m[1].trim()}` },
  // Work
  { re: /i(?:'m| am)(?: a| an)?\s+([\w\s]+?)\s+(?:at|for|in)\s+([\w\s]+?)(?:\.|,|$)/gi, topic: "work",        tpl: m => `User is a ${m[1].trim()} at ${m[2].trim()}` },
  { re: /(?:our|my) (?:team|company|startup|org)\s+(?:is called|is named|is)\s+(.+?)(?:\.|,|$)/gi, topic: "work", tpl: m => `User's team/company: ${m[1].trim()}` },
  // Preferences
  { re: /i (?:prefer|love|like|always use)\s+(.+?)(?:\.|,|$)/gi,                         topic: "preferences", tpl: m => `User prefers ${m[1].trim()}` },
  { re: /i (?:don'?t like|hate|avoid|dislike|never use)\s+(.+?)(?:\.|,|$)/gi,            topic: "preferences", tpl: m => `User dislikes ${m[1].trim()}` },
  // Projects
  { re: /i(?:'m| am) (?:building|working on|developing|creating|making)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User is building ${m[1].trim()}` },
  { re: /(?:entering|participating in|submitting to)\s+(.+?hackathon.+?)(?:\.|,|$)/gi,   topic: "projects",    tpl: m => `User is participating in ${m[1].trim()}` },
  { re: /(?:my|our) (?:app|project|product|startup|tool)\s+(?:is called|is named|is)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User's project: ${m[1].trim()}` },
  { re: /deadline (?:is|on|:)\s+(.+?)(?:\.|,|$)/gi,                                      topic: "projects",    tpl: m => `Deadline: ${m[1].trim()}` },
  // Tech
  { re: /(?:using|our stack is|tech stack(?:\s+is)?|built with|we use)\s+(.+?)(?:\.|,|$)/gi, topic: "work",    tpl: m => `User's stack: ${m[1].trim()}` },
  { re: /i use\s+(React|Vue|Angular|Next\.?js|Node|Python|Java|Go|Rust|TypeScript|JavaScript|Flutter|Swift|Kotlin|Svelte|Django|FastAPI|Postgres|MongoDB|Redis|Docker|Kubernetes)(?:\s|,|\.)/gi, topic: "preferences", tpl: m => `User uses ${m[1]}` },
  // Goals / learning
  { re: /i(?:'m| am) (?:learning|studying|taking)\s+(.+?)(?:\.|,|$)/gi,                  topic: "work",        tpl: m => `User is learning ${m[1].trim()}` },
  { re: /my goal is (?:to\s+)?(.+?)(?:\.|,|$)/gi,                                        topic: "general",     tpl: m => `User's goal: ${m[1].trim()}` },
];

export function extractWithRegex(
  messages: { role: string; content: string }[]
): ExtractedMemory[] {
  const userText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const facts: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(userText)) !== null) {
      const content = tpl(m);
      const key = content.toLowerCase().slice(0, 40);
      if (content.length < 12 || seen.has(key)) continue;
      seen.add(key);
      facts.push({
        content,
        topic,
        keywords: content.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 6),
        confidence: 0.75,
      });
    }
  }
  return facts;
}

// ─────────────────────────────────────────────────────────────────
// Unified extractor — Groq first, regex fallback
// ─────────────────────────────────────────────────────────────────

export async function extractMemories(
  messages: { role: string; content: string }[],
  groqApiKey?: string
): Promise<ExtractedMemory[]> {
  if (groqApiKey && groqApiKey !== "gsk_YOUR_GROQ_KEY_HERE") {
    try {
      const results = await extractWithGroq(messages, groqApiKey);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("[Imprint] Groq extraction failed, falling back to regex:", err);
    }
  }
  return extractWithRegex(messages);
}

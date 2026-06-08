import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, searchMemories, Topic } from "@/lib/dynamodb";

// ── Rule-based extraction (no Bedrock needed) ─────────────
interface ExtractedMemory { content: string; topic: Topic; keywords: string[]; confidence: number; }

const PATTERNS: { re: RegExp; topic: Topic; tpl: (m: RegExpExecArray) => string }[] = [
  { re: /(?:my name is|i(?:'m| am) called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi, topic: "personal",     tpl: m => `User's name is ${m[1]}` },
  { re: /(?:i(?:'m| am) (?:from|in|based in)|i live in)\s+([A-Za-z\s,]+?)(?:\.|,|$)/gi, topic: "personal", tpl: m => `User is from/in ${m[1].trim()}` },
  { re: /i(?:'m| am)(?: a| an)?\s+([\w\s]+?)\s+(?:at|for|in)\s+([\w\s]+?)(?:\.|,|$)/gi, topic: "work",    tpl: m => `User is a ${m[1].trim()} at ${m[2].trim()}` },
  { re: /i (?:prefer|love|like|always use)\s+(.+?)(?:\.|,|$)/gi, topic: "preferences",                     tpl: m => `User prefers ${m[1].trim()}` },
  { re: /i (?:don't like|hate|avoid|dislike)\s+(.+?)(?:\.|,|$)/gi, topic: "preferences",                   tpl: m => `User dislikes ${m[1].trim()}` },
  { re: /i(?:'m| am) (?:building|working on|developing|creating)\s+(.+?)(?:\.|,|$)/gi, topic: "projects",   tpl: m => `User is building ${m[1].trim()}` },
  { re: /(?:entering|participating in|submitting to)\s+(.+?hackathon.+?)(?:\.|,|$)/gi, topic: "projects",   tpl: m => `User is participating in ${m[1].trim()}` },
  { re: /deadline (?:is|on)\s+(.+?)(?:\.|,|$)/gi, topic: "projects",                                        tpl: m => `Deadline: ${m[1].trim()}` },
  { re: /(?:using|our stack is|tech stack(?:\s+is)?)\s+(.+?)(?:\.|,|$)/gi, topic: "work",                  tpl: m => `User's stack: ${m[1].trim()}` },
  { re: /i use\s+(React|Vue|Angular|Next\.?js|Node|Python|Java|Go|Rust|TypeScript|JavaScript|Flutter|Swift|Kotlin)(?:\s|,|\.)/gi, topic: "preferences", tpl: m => `User uses ${m[1]}` },
];

function extractFromMessages(messages: { role: string; content: string }[]): ExtractedMemory[] {
  const userText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const facts: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(userText)) !== null) {
      const content = tpl(m);
      if (content.length < 15 || seen.has(content.toLowerCase().slice(0, 40))) continue;
      seen.add(content.toLowerCase().slice(0, 40));
      facts.push({ content, topic, keywords: content.toLowerCase().split(/\s+/).slice(0, 5), confidence: 0.85 });
    }
  }
  return facts;
}

// Simple rule-based contradiction check (no Bedrock)
function detectContradictions(newMems: ExtractedMemory[], existing: any[]) {
  const contradictions: any[] = [];
  for (const n of newMems) {
    for (const e of existing) {
      if (n.topic !== e.topic) continue;
      // Flag if same opening words but different content
      const nWords = n.content.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      const eWords = (e.content || "").toLowerCase().split(/\s+/).slice(0, 4).join(" ");
      if (nWords === eWords && n.content !== e.content) {
        contradictions.push({ newMemoryContent: n.content, existingMemoryId: e.memoryId, existingMemoryContent: e.content, explanation: `Updated: "${e.content}" → "${n.content}"` });
      }
    }
  }
  return contradictions;
}

// GET /api/memories?userId=&topic=&search=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search = req.nextUrl.searchParams.get("search");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const memories = search
      ? await searchMemories(userId, search)
      : await getMemories(userId, topic || undefined);
    return NextResponse.json({ memories });
  } catch (err) {
    console.error("GET /api/memories error:", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

// POST /api/memories — extract + save from conversation (extension calls this)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, messages, source } = body;
  if (!userId || !messages) return NextResponse.json({ error: "userId and messages required" }, { status: 400 });

  try {
    const extracted = extractFromMessages(messages);
    if (!extracted.length) return NextResponse.json({ memories: [], contradictions: [] });

    const existing = await getMemories(userId, undefined, 100);
    const contradictions = detectContradictions(extracted, existing);

    // Skip facts already in existing
    const existingContents = new Set(existing.map(e => e.content?.toLowerCase().slice(0, 40)));
    const toSave = extracted.filter(m => !existingContents.has(m.content.toLowerCase().slice(0, 40)));

    const saved = await Promise.all(
      toSave.map(m => saveMemory({
        userId, content: m.content, topic: m.topic,
        keywords: m.keywords, pinned: false,
        contradicts: [], confidence: m.confidence,
        source: source || "claude.ai",
      }))
    );

    return NextResponse.json({ memories: saved, contradictions });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}

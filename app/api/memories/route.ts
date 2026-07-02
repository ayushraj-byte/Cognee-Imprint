import { NextRequest, NextResponse } from "next/server";
import { getMemories, saveMemory, searchMemories, deleteMemory, updateMemory, getCustomProjects, saveCustomProjects, Topic } from "@/lib/dynamodb";
import { extractMemories } from "@/lib/extract";
import { detectSemanticContradictions } from "@/lib/contradiction";
import { rankMemories } from "@/lib/rank";
import { getMemoryPool, invalidateMemoryPool } from "@/lib/pool";
import { embed, cosineSimilarity } from "@/lib/embeddings";
import { optimizeContext } from "@/lib/context-optimizer";
import { cogneeSemanticSearch, recordFeedback, supersedeMemory } from "@/lib/memory-store";
import type { Memory } from "@/lib/dynamodb";

// Merge all pinned memories into a result set (pinned first, de-duplicated by id).
// Pinned = "always remember", so they must survive any relevance/limit filtering.
function withPinned(all: Memory[], results: Memory[]): Memory[] {
  const seen = new Set(results.map(m => m.memoryId));
  const pinned = all.filter(m => m.pinned && !seen.has(m.memoryId));
  return [...pinned, ...results];
}

// Strip embeddings from API responses — clients never use them; they bloat the
// payload and (left in the row) cap how many memories fit in a DynamoDB page.
function lite(memories: Memory[]) {
  return memories.map(({ embedding, ...rest }) => rest);
}

// Auto-group a project memory under a custom project: tag it to an existing
// project whose name appears in the content; or, if the content opens with a
// "ProjectName: …" label we don't have a project for yet, create that project.
const GENERIC_PREFIX = /^(completed|next|next up|decided|decision|blocked|fixed|added|deployed|todo|update|note|done|issue|task|progress|status|summary|session|memory|fact|reminder)$/i;
// A project is auto-created only once this many memories share its name — so a
// stray mention never spawns a project, but a topic you work on a lot becomes one.
const PROJECT_THRESHOLD = 50;

// Guard against the classifier dumping a technical fact into "health" (e.g. a
// "cookie persistence" bug is not a medical condition). If a health-tagged fact
// reads as technical and shows no medical signal, route it to "general" instead.
const TECH_RE = /\b(cookie|session|cache|token|auth|oauth|api|endpoint|server|serverless|database|dynamodb|sql|deploy|vercel|netlify|frontend|backend|css|html|json|javascript|typescript|react|vue|next\.?js|node|lambda|bug|error|crash|timeout|build|commit|repo|git|mcp|embedding|persistence|localstorage|cors|webhook|render|hydration)\b/i;
const MEDICAL_RE = /\b(diabet|health|sleep|diet|fitness|workout|exercise|allerg|medication|medicine|doctor|hospital|pain|anxiety|depress|blood|sugar|weight|injury|disease|illness|condition|symptom|therapy|nutrition|wellbeing|mental|insulin|cholesterol)\b/i;
function sanitizeTopic(content: string, topic: string): Topic {
  if (topic === "health" && TECH_RE.test(content) && !MEDICAL_RE.test(content)) return "general";
  return topic as Topic;
}

// How many existing memories to pull into the contradiction-detection pool.
// Detection ranks this pool by embedding similarity, so it must be wide enough
// to actually contain the fact being contradicted. The old paths fetched only
// 100–500 newest rows, so older conflicting facts were never even loaded.
const CONTRADICTION_POOL = 1000;
async function autoTagProject(userId: string, content: string, topic: string, existing: { content?: string }[]): Promise<string[]> {
  if (topic !== "projects") return [];
  try {
    const projects = await getCustomProjects(userId);
    const lc = content.toLowerCase();
    const hit = projects.find(p => p.name && p.name.length > 1 && lc.includes(p.name.toLowerCase()));
    if (hit) return [hit.id];                       // project already exists → just group under it
    const m = content.match(/^\s*([A-Za-z][\w .+#-]{1,39}?)\s*[:–—-]\s/);
    if (m) {
      const name = m[1].trim();
      if (name.length >= 2 && !GENERIC_PREFIX.test(name)) {
        // Only create the project once enough saved memories already share this name.
        const nameLc = name.toLowerCase();
        const related = existing.filter(e => (e.content || "").toLowerCase().includes(nameLc)).length + 1;
        if (related < PROJECT_THRESHOLD) return [];
        const COLORS = ["#f0b46a", "#5eead4", "#a78bfa", "#f87171", "#34d399", "#60a5fa"];
        const proj = { id: `proj-auto-${Date.now()}`, name, color: COLORS[projects.length % COLORS.length] };
        await saveCustomProjects(userId, [...projects, proj]);
        return [proj.id];
      }
    }
  } catch { /* tagging is best-effort */ }
  return [];
}

// GET /api/memories?userId=&topic=&search=&semantic=
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const topic = req.nextUrl.searchParams.get("topic") as Topic | null;
  const search   = req.nextUrl.searchParams.get("search");
  const semantic = req.nextUrl.searchParams.get("semantic");
  const optimize = req.nextUrl.searchParams.get("optimize") === "true";
  const budget   = parseInt(req.nextUrl.searchParams.get("budget") || "2000");
  const limit    = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 2000);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // Semantic search — powered by Cognee Cloud's knowledge graph. Cognee finds
    // the most relevant memories (graph + vector retrieval); pinned memories are
    // always included. Falls back to keyword ranking internally if Cognee is
    // unavailable (see cogneeSemanticSearch).
    if (semantic) {
      const all = await getMemories(userId, undefined, 2000);
      const relevant = await cogneeSemanticSearch(userId, semantic, 30);
      return NextResponse.json({ memories: lite(rankMemories(withPinned(all, relevant))) });
    }

    // Keyword search
    if (search) {
      const raw = await searchMemories(userId, search);
      return NextResponse.json({ memories: lite(rankMemories(raw)) });
    }

    // Standard fetch — ranked, optionally trimmed to token budget
    const raw = await getMemories(userId, topic || undefined, limit);
    const ranked = rankMemories(raw);
    const memories = optimize ? optimizeContext(ranked, budget) : ranked;
    return NextResponse.json({ memories: lite(memories) });
  } catch (err) {
    console.error("GET /api/memories error:", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

// POST /api/memories
// Direct save (MCP): { userId, content, topic, pinned, source }
// Batch extraction: { userId, messages, source, groqApiKey }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, content, topic, pinned, messages, source, groqApiKey, lesson, mistake, fix } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    // Direct single-memory save (from MCP)
    if (content) {
      let embedding: number[] | undefined;
      if (process.env.JINA_API_KEY) {
        try { embedding = await embed(content, process.env.JINA_API_KEY, "retrieval.passage"); } catch {}
      }

      // Fetch a wide pool once — reused for dedup, contradiction ranking, and
      // auto-tagging. Detection ranks this pool by embedding similarity, so it
      // must be broad enough to contain the fact being contradicted.
      const existing = await getMemoryPool(userId, CONTRADICTION_POOL);
      const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
      const newPrefix = norm(content).slice(0, 40);
      let dup = existing.find(e => norm(e.content).slice(0, 40) === newPrefix);
      if (!dup && embedding) {
        // Catch paraphrases / re-wordings via semantic similarity.
        dup = existing.find(e => e.embedding && cosineSimilarity(embedding!, e.embedding) > 0.92);
      }
      if (dup) {
        // If this save asked to pin and the existing one isn't, upgrade it.
        if (pinned && !dup.pinned) {
          try { await updateMemory(userId, dup.memoryId, dup.createdAt, { pinned: true }); dup.pinned = true; } catch {}
        }
        return NextResponse.json({ memory: lite([dup])[0], deduped: true });
      }

      // Real-time contradiction detection — semantically ranks the whole pool and
      // LLM-checks the most similar facts (runs on every save path).
      const memTopic = sanitizeTopic(content, topic || "general");
      const groqKey = groqApiKey || process.env.GROQ_API_KEY;
      const contradictions = groqKey
        ? await detectSemanticContradictions(
            [{ content, topic: memTopic, embedding, clientId: "new" }],
            existing,
            groqKey
          )
        : [];
      const contradictIds = contradictions.map(c => c.existingMemoryId);
      const reasonsForNew: Record<string, string> = {};
      for (const c of contradictions) reasonsForNew[c.existingMemoryId] = c.explanation;

      // Auto-group project memories under the matching (or a new) custom project.
      const tags = await autoTagProject(userId, content, memTopic, existing);

      const memory = await saveMemory({
        userId,
        content,
        topic: memTopic,
        keywords: content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 6),
        pinned: pinned || false,
        contradicts: contradictIds,
        conflictReasons: reasonsForNew,
        confidence: 1.0,
        source: source || "mcp",
        embedding,
        tags,
        lesson: lesson || undefined,
        mistake: mistake || undefined,
        fix: fix || undefined,
      });

      // Flag the conflicting memories back (bi-directional), carrying the reason
      // so both sides can explain the conflict.
      if (contradictIds.length) {
        await Promise.all(
          existing
            .filter(e => contradictIds.includes(e.memoryId))
            .map(e =>
              updateMemory(userId, e.memoryId, e.createdAt, {
                contradicts: Array.from(new Set([...(e.contradicts || []), memory.memoryId])),
                conflictReasons: { ...(e.conflictReasons || {}), [memory.memoryId]: reasonsForNew[e.memoryId] || "" },
              }).catch(() => {})
            )
        );
      }

      invalidateMemoryPool(userId);
      return NextResponse.json({ memory: lite([memory])[0], contradictions });
    }

    // Extraction from a batch of conversation messages
    if (!messages) return NextResponse.json({ error: "content or messages required" }, { status: 400 });

    const key = groqApiKey || process.env.GROQ_API_KEY;
    const extracted = await extractMemories(messages, key);
    if (!extracted.length) return NextResponse.json({ memories: [], contradictions: [] });

    const existing = await getMemories(userId, undefined, CONTRADICTION_POOL);

    // Dedup BEFORE detection so an identical re-extraction never reaches the LLM
    // and never ranks its own stored twin as a "contradiction".
    const existingSet = new Set(existing.map((e) => e.content?.toLowerCase().slice(0, 40)));
    const toSave = extracted.filter(m => !existingSet.has(m.content.toLowerCase().slice(0, 40)));
    if (!toSave.length) return NextResponse.json({ memories: [], contradictions: [] });

    // Embed everything up front so detection can rank semantically (and so we
    // don't embed twice). Each new memory gets a stable clientId for mapping hits.
    const embeddings = await Promise.all(
      toSave.map(async m => {
        if (!process.env.JINA_API_KEY) return undefined;
        try { return await embed(m.content, process.env.JINA_API_KEY, "retrieval.passage"); } catch { return undefined; }
      })
    );
    const newMems = toSave.map((m, i) => ({ content: m.content, topic: m.topic, embedding: embeddings[i], clientId: String(i) }));

    // Semantic contradiction detection via Groq
    const contradictions = key
      ? await detectSemanticContradictions(newMems, existing, key)
      : [];

    const saved = await Promise.all(
      toSave.map((m, i) =>
        saveMemory({
          userId, content: m.content, topic: sanitizeTopic(m.content, m.topic),
          keywords: m.keywords, pinned: false,
          contradicts: contradictions.filter(c => c.newMemoryClientId === String(i)).map(c => c.existingMemoryId),
          conflictReasons: contradictions
            .filter(c => c.newMemoryClientId === String(i))
            .reduce((acc, c) => { acc[c.existingMemoryId] = c.explanation; return acc; }, {} as Record<string, string>),
          confidence: m.confidence,
          source: source || "web",
          embedding: embeddings[i],
        })
      )
    );

    // Bi-directional flagging for the batch path too: point each conflicting
    // existing memory back at the new memory that contradicted it (with reason).
    if (contradictions.length) {
      const savedByClient = new Map(toSave.map((_, i) => [String(i), saved[i]]));
      const existingById = new Map(existing.map(e => [e.memoryId, e]));
      const backRefs = new Map<string, { ids: Set<string>; reasons: Record<string, string> }>();
      for (const c of contradictions) {
        const newSaved = savedByClient.get(c.newMemoryClientId || "");
        if (!newSaved) continue;
        if (!backRefs.has(c.existingMemoryId)) backRefs.set(c.existingMemoryId, { ids: new Set(), reasons: {} });
        const ref = backRefs.get(c.existingMemoryId)!;
        ref.ids.add(newSaved.memoryId);
        ref.reasons[newSaved.memoryId] = c.explanation;
      }
      await Promise.all(
        [...backRefs.entries()].map(([eid, ref]) => {
          const e = existingById.get(eid);
          if (!e) return Promise.resolve();
          return updateMemory(userId, eid, e.createdAt, {
            contradicts: Array.from(new Set([...(e.contradicts || []), ...ref.ids])),
            conflictReasons: { ...(e.conflictReasons || {}), ...ref.reasons },
          }).catch(() => {});
        })
      );
    }

    invalidateMemoryPool(userId);
    return NextResponse.json({ memories: lite(saved), contradictions });
  } catch (err) {
    console.error("POST /api/memories error:", err);
    return NextResponse.json({ error: "Failed to save memories" }, { status: 500 });
  }
}

// PATCH /api/memories — update pinned/content/topic/tags
export async function PATCH(req: NextRequest) {
  const { userId, memoryId, createdAt, pinned, content, topic, tags, feedback, supersededBy } = await req.json();
  if (!userId || !memoryId) {
    return NextResponse.json({ error: "userId, memoryId required" }, { status: 400 });
  }
  try {
    // Learning — 👍/👎 feedback adjusts confidence and fires Cognee improve().
    if (feedback === "up" || feedback === "down") {
      const r = await recordFeedback(userId, memoryId, feedback);
      invalidateMemoryPool(userId);
      return NextResponse.json({ success: true, feedback: r });
    }
    // Learning — correction: mark this memory superseded by a newer one.
    if (supersededBy) {
      await supersedeMemory(userId, memoryId, supersededBy);
      invalidateMemoryPool(userId);
      return NextResponse.json({ success: true, superseded: true });
    }
    if (!createdAt) return NextResponse.json({ error: "createdAt required" }, { status: 400 });
    const updates: Partial<Pick<Memory, "content" | "pinned" | "topic" | "tags">> = {};
    if (pinned !== undefined) updates.pinned = pinned;
    if (content !== undefined) updates.content = content;
    if (topic !== undefined) updates.topic = topic;
    if (tags !== undefined) updates.tags = tags;
    await updateMemory(userId, memoryId, createdAt, updates);
    invalidateMemoryPool(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/memories error:", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

// DELETE /api/memories?userId=&memoryId=&createdAt=
export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const memoryId = req.nextUrl.searchParams.get("memoryId");
  const createdAt = req.nextUrl.searchParams.get("createdAt");
  if (!userId || !memoryId || !createdAt) {
    return NextResponse.json({ error: "userId, memoryId, createdAt required" }, { status: 400 });
  }
  try {
    await deleteMemory(userId, memoryId, createdAt);
    invalidateMemoryPool(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/memories error:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}

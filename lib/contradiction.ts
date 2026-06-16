const SYSTEM = `You compare two factual statements about the same person.
Return JSON only: { "contradicts": boolean, "reason": string, "confidence": number }
Contradiction = they cannot both be true at the same time.
Examples:
- "uses React" vs "switched to Vue, no longer uses React" → contradicts: true
- "is a student" vs "graduated and works as engineer" → contradicts: true
- "prefers dark mode" vs "likes light themes" → contradicts: true
- "building project X" vs "also building project Y" → contradicts: false
- same fact worded differently → contradicts: false
Be strict: only flag real logical conflicts, not additions or updates.`;

export async function checkContradiction(
  newContent: string,
  existingContent: string,
  groqKey: string
): Promise<{ contradicts: boolean; reason: string; confidence: number }> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Fact A (new): "${newContent}"\nFact B (stored): "${existingContent}"`,
          },
        ],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return { contradicts: false, reason: "", confidence: 0 };

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      contradicts: !!parsed.contradicts,
      reason: String(parsed.reason ?? ""),
      confidence: Number(parsed.confidence) || 0.8,
    };
  } catch {
    return { contradicts: false, reason: "", confidence: 0 };
  }
}

// Compares each new memory against up to 5 same-topic existing memories in parallel.
// Returns only confirmed contradictions with confidence ≥ 0.7.
export async function detectSemanticContradictions(
  newMems: { content: string; topic: string }[],
  existing: { memoryId: string; content: string; topic: string }[],
  groqKey: string
): Promise<
  {
    newMemoryContent: string;
    existingMemoryId: string;
    existingMemoryContent: string;
    explanation: string;
    confidence: number;
  }[]
> {
  const results: {
    newMemoryContent: string;
    existingMemoryId: string;
    existingMemoryContent: string;
    explanation: string;
    confidence: number;
  }[] = [];

  await Promise.all(
    newMems.map(async (n) => {
      const sameTopic = existing
        .filter((e) => e.topic === n.topic)
        .slice(0, 5);

      await Promise.all(
        sameTopic.map(async (e) => {
          const check = await checkContradiction(n.content, e.content, groqKey);
          if (check.contradicts && check.confidence >= 0.7) {
            results.push({
              newMemoryContent: n.content,
              existingMemoryId: e.memoryId,
              existingMemoryContent: e.content,
              explanation: check.reason,
              confidence: check.confidence,
            });
          }
        })
      );
    })
  );

  return results;
}

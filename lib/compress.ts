export async function compressMemories(
  memories: { content: string; topic: string }[],
  groqKey: string
): Promise<string> {
  const items = memories.map((m, i) => `${i + 1}. ${m.content}`).join("\n");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "Compress a list of related facts about the same person into one dense, accurate summary sentence. Preserve ALL distinct facts — never drop information. Return only the compressed sentence, nothing else.",
        },
        {
          role: "user",
          content: `Compress these ${memories.length} facts into one sentence:\n${items}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`Compress API error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

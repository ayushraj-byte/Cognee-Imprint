// Jina AI embeddings — free tier: 1M tokens/month, no credit card required
// Sign up at jina.ai → API Keys → copy key → set JINA_API_KEY in Vercel env vars
// jina-embeddings-v3: 1024 dims, strong multilingual retrieval performance

export async function embed(
  text: string,
  jinaKey: string,
  task: "retrieval.passage" | "retrieval.query" = "retrieval.passage"
): Promise<number[]> {
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jinaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      input: [text],
      task,
      dimensions: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Jina embedding error ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

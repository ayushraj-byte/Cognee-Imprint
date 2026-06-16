import { NextRequest, NextResponse } from "next/server";
import { ddb } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE || "imprint-memories";

interface DigestMemory {
  memoryId: string;
  content: string;
  topic: string;
  source: string;
  pinned: boolean;
  createdAt: string;
}

export async function POST(req: NextRequest) {
  const { userId, email } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": userId },
    ScanIndexForward: false,
  }));

  const all: DigestMemory[] = (res.Items ?? []) as DigestMemory[];
  const now = Date.now();

  const pinned = all.filter(m => m.pinned);
  const newThisWeek = all.filter(m => {
    const age = now - new Date(m.createdAt).getTime();
    return age < 7 * 86400_000;
  });
  const stale = all.filter(m => {
    const age = now - new Date(m.createdAt).getTime();
    return !m.pinned && age > 30 * 86400_000;
  });

  // Group by topic
  const byTopic: Record<string, DigestMemory[]> = {};
  for (const m of all) {
    const t = m.topic || "general";
    (byTopic[t] ??= []).push(m);
  }

  const digest = {
    generatedAt: new Date().toISOString(),
    total: all.length,
    pinned: pinned.length,
    newThisWeek: newThisWeek.length,
    staleCount: stale.length,
    topics: Object.entries(byTopic).map(([topic, mems]) => ({
      topic,
      count: mems.length,
      sample: mems.slice(0, 2).map(m => m.content),
    })),
    recentHighlights: newThisWeek.slice(0, 5).map(m => ({
      content: m.content,
      topic: m.topic,
      source: m.source,
    })),
    staleMemories: stale.slice(0, 5).map(m => ({
      id: m.memoryId,
      content: m.content,
      topic: m.topic,
    })),
  };

  // Send via Resend if configured
  if (email && process.env.RESEND_API_KEY) {
    try {
      await sendDigestEmail(email, digest);
    } catch (e) {
      console.error("Resend error:", e);
      return NextResponse.json({ digest, emailStatus: "failed" });
    }
    return NextResponse.json({ digest, emailStatus: "sent" });
  }

  return NextResponse.json({ digest, emailStatus: email ? "no_resend_key" : "skipped" });
}

async function sendDigestEmail(email: string, digest: ReturnType<typeof buildDigest>) {
  const html = buildEmailHtml(digest);
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Imprint <digest@imprint.app>",
      to: [email],
      subject: `Your Imprint Weekly Digest — ${digest.newThisWeek} new memories`,
      html,
    }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDigest(digest: any) { return digest; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEmailHtml(digest: any): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #e3e3e3; margin: 0; padding: 24px; }
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 12px 0; }
  h1 { color: #fff; font-size: 24px; margin: 0 0 4px; }
  h2 { color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 400; margin: 0 0 24px; }
  .stat { display: inline-block; margin-right: 24px; }
  .stat-n { font-size: 28px; font-weight: 700; color: #4EECD8; }
  .stat-l { font-size: 12px; color: rgba(255,255,255,0.5); }
  .mem { font-size: 13px; color: rgba(255,255,255,0.8); padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .tag { font-size: 11px; color: rgba(255,255,255,0.35); margin-left: 6px; }
</style></head>
<body>
  <h1>Your Imprint Digest</h1>
  <h2>${new Date(digest.generatedAt).toDateString()}</h2>
  <div class="card">
    <div class="stat"><div class="stat-n">${digest.total}</div><div class="stat-l">Total memories</div></div>
    <div class="stat"><div class="stat-n">${digest.newThisWeek}</div><div class="stat-l">New this week</div></div>
    <div class="stat"><div class="stat-n">${digest.pinned}</div><div class="stat-l">Pinned</div></div>
    <div class="stat"><div class="stat-n">${digest.staleCount}</div><div class="stat-l">Stale (30d+)</div></div>
  </div>
  ${digest.recentHighlights.length ? `
  <div class="card">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:rgba(255,255,255,0.6)">NEW THIS WEEK</div>
    ${digest.recentHighlights.map((m: {content: string; topic: string; source: string}) => `<div class="mem">${m.content}<span class="tag">#${m.topic}</span></div>`).join("")}
  </div>` : ""}
  <p style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:32px">
    Manage your memories at <a href="https://imprint-ebon.vercel.app/dashboard" style="color:#4EECD8">imprint-ebon.vercel.app</a>
  </p>
</body></html>`;
}

import { NextRequest, NextResponse } from "next/server";
import { saveMemory } from "@/lib/dynamodb";

export async function POST(req: NextRequest) {
  try {
    const { userId, githubToken, repo } = await req.json();

    if (!userId || !githubToken) {
      return NextResponse.json({ error: "userId and githubToken required" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const memories: string[] = [];

    // Fetch open PRs
    if (repo) {
      const prsRes = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`, { headers });
      if (prsRes.ok) {
        const prs = await prsRes.json();
        for (const pr of prs) {
          memories.push(`Has an open PR on GitHub: "${pr.title}" (#${pr.number}) in ${repo}`);
        }
      }

      // Fetch assigned issues
      const issuesRes = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&assignee=@me&per_page=10`, { headers });
      if (issuesRes.ok) {
        const issues = await issuesRes.json();
        for (const issue of issues.filter((i: any) => !i.pull_request)) {
          memories.push(`Has an open GitHub issue assigned: "${issue.title}" (#${issue.number}) in ${repo}`);
        }
      }
    }

    // Fetch user info
    const userRes = await fetch("https://api.github.com/user", { headers });
    if (userRes.ok) {
      const ghUser = await userRes.json();
      if (ghUser.login) memories.push(`GitHub username: ${ghUser.login}`);
      if (ghUser.company) memories.push(`Works at ${ghUser.company} (from GitHub profile)`);
      if (ghUser.bio) memories.push(`GitHub bio: ${ghUser.bio}`);
    }

    // Fetch pinned/top repos
    const reposRes = await fetch("https://api.github.com/user/repos?sort=pushed&per_page=5", { headers });
    if (reposRes.ok) {
      const repos = await reposRes.json();
      if (repos.length) {
        const names = repos.map((r: any) => r.name).join(", ");
        memories.push(`Recently active GitHub repositories: ${names}`);
      }
    }

    if (!memories.length) {
      return NextResponse.json({ count: 0, memories: [] });
    }

    const saved = await Promise.all(
      memories.map(content =>
        saveMemory({ userId, content, topic: "work", keywords: content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 6), confidence: 0.85, pinned: false, source: "github", contradicts: [] })
      )
    );

    return NextResponse.json({ count: saved.length, memories: saved });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

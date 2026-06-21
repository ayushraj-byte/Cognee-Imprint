import { NextRequest, NextResponse } from "next/server";
import { getCustomProjects, saveCustomProjects } from "@/lib/dynamodb";

// GET /api/projects?userId=  → { projects }
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  try {
    const projects = await getCustomProjects(userId);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// PUT /api/projects  { userId, projects } → replace the user's custom project list
export async function PUT(req: NextRequest) {
  const { userId, projects } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  try {
    await saveCustomProjects(userId, Array.isArray(projects) ? projects : []);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/projects error:", err);
    return NextResponse.json({ error: "Failed to save projects" }, { status: 500 });
  }
}

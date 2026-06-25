import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Authorization helpers.
//
// Browser/dashboard requests carry a NextAuth session whose `user.id` IS the
// userId. The keyless MCP server / stop-hook do NOT — they call the API with a
// userId param and no session. So these guards are for routes that are ONLY ever
// called from the logged-in dashboard; applying them to MCP-shared routes
// (/api/memories CRUD, /api/rules, /api/sessions) would lock out the MCP.

// Require a signed-in session that owns `userId`. Returns null when authorized,
// or a 401/403 response to return immediately.
export async function requireOwner(userId: string | null | undefined): Promise<NextResponse | null> {
  const session = await auth();
  const sid = session?.user?.id;
  if (!sid) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!userId || sid !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

// For expensive maintenance endpoints (backfill, recheck): allow either the
// session owner OR a request carrying the ADMIN_KEY. Returns null when allowed.
export async function requireOwnerOrAdminKey(userId: string | null | undefined, providedKey: unknown): Promise<NextResponse | null> {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && typeof providedKey === "string" && providedKey === adminKey) return null;
  return requireOwner(userId);
}

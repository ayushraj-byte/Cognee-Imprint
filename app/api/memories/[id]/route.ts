import { NextRequest, NextResponse } from "next/server";
import { updateMemory, deleteMemory, Topic } from "@/lib/dynamodb";

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/memories/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: memoryId } = await params;
  const body = await req.json();
  const { userId, createdAt, content, pinned, topic } = body;

  if (!userId || !createdAt) {
    return NextResponse.json(
      { error: "userId and createdAt required" },
      { status: 400 }
    );
  }

  try {
    await updateMemory(userId, memoryId, createdAt, {
      ...(content !== undefined && { content }),
      ...(pinned !== undefined && { pinned }),
      ...(topic !== undefined && { topic: topic as Topic }),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/memories error:", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

// DELETE /api/memories/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: memoryId } = await params;
  const { userId, createdAt } = await req.json();

  if (!userId || !createdAt) {
    return NextResponse.json(
      { error: "userId and createdAt required" },
      { status: 400 }
    );
  }

  try {
    await deleteMemory(userId, memoryId, createdAt);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/memories error:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}

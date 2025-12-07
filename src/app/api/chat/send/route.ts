import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function buildRoomId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { toHandle, content } = await request.json();

    if (!toHandle || typeof toHandle !== "string") {
      return NextResponse.json({ error: "Missing toHandle" }, { status: 400 });
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const meId = (session.user as any).id as string;

    const peer = await prisma.user.findUnique({ where: { handle: toHandle } });
    if (!peer) {
      return NextResponse.json({ error: "Peer not found" }, { status: 404 });
    }

    if (peer.id === meId) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    // Ensure there is an accepted friend request in either direction
    const accepted = await prisma.friendRequest.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { fromUserId: meId, toUserId: peer.id },
          { fromUserId: peer.id, toUserId: meId },
        ],
      },
    });

    if (!accepted) {
      return NextResponse.json(
        { error: "No accepted connection between these users" },
        { status: 403 }
      );
    }

    const roomId = buildRoomId(meId, peer.id);

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: meId,
        roomId,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
        roomId: true,
      },
    });

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[chat/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

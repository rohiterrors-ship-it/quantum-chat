import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function buildRoomId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const peerHandle = url.searchParams.get("peerHandle");

    if (!peerHandle) {
      return NextResponse.json({ error: "Missing peerHandle" }, { status: 400 });
    }

    const meId = (session.user as any).id as string;

    const peer = await prisma.user.findUnique({ where: { handle: peerHandle } });
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

    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
      },
    });

    return NextResponse.json({
      roomId,
      peer: {
        id: peer.id,
        handle: peer.handle,
        name: peer.name,
        email: peer.email,
        image: peer.image,
      },
      messages,
    });
  } catch (err) {
    console.error("[chat/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

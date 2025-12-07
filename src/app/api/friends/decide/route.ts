import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const toUserId = (session.user as any).id as string;
    const { requestId, action } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    if (action !== "ACCEPT" && action !== "REJECT") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest || friendRequest.toUserId !== toUserId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED" },
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("[friends/decide]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

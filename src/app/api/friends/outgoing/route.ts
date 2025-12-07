import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fromUserId = (session.user as any).id as string;

    const requests = await prisma.friendRequest.findMany({
      where: { fromUserId },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: {
          select: {
            id: true,
            handle: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    const shaped = requests.map((r) => ({
      id: r.id,
      status: r.status,
      categories: r.categories.split(",").filter(Boolean),
      message: r.message,
      createdAt: r.createdAt,
      toUser: r.toUser,
    }));

    return NextResponse.json({ requests: shaped });
  } catch (err) {
    console.error("[friends/outgoing]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

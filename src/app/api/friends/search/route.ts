import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { handle } = await request.json();

    if (!handle || typeof handle !== "string") {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }

    const raw = handle.trim();
    const normalizedHandle = raw.startsWith("@") ? raw.slice(1) : raw;

    const user = await prisma.user.findUnique({
      where: { handle: normalizedHandle },
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[friends/search]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

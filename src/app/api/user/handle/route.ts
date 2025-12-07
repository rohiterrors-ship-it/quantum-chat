import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function validateHandle(value: string) {
  const trimmed = value.trim();
  const digitCount = (trimmed.match(/\d/g) || []).length;
  const isValidLength = trimmed.length >= 6;
  const isValidDigits = digitCount >= 4;
  if (!isValidLength || !isValidDigits) {
    return {
      ok: false,
      message:
        "Your quantum ID must be at least 6 characters and include at least 4 numbers.",
    } as const;
  }
  return { ok: true as const, value: trimmed };
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = (session.user as any).id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "User id missing in session" }, { status: 400 });
  }

  let body: { handle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawHandle = body.handle ?? "";
  const validation = validateHandle(rawHandle);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const handle = validation.value;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { handle },
      select: { id: true, handle: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "That quantum ID is already taken. Please choose a different one." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to update quantum ID. Please try again." },
      { status: 500 },
    );
  }
}

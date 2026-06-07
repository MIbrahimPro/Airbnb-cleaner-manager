import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function sanitizePassword(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = sanitizeEmail(body.email);
    const password = sanitizePassword(body.password);

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email and password are required.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email, active: true }).lean();

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Login failed.",
      },
      { status: 500 },
    );
  }
}


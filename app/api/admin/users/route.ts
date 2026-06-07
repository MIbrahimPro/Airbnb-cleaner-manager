import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { hashPassword } from "@/lib/password";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRole = "CLEANER" | "MANAGER" | "ADMIN";

function sanitizeText(value: unknown, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function sanitizeEmail(value: unknown) {
  return sanitizeText(value, 180).toLowerCase();
}

function sanitizePassword(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) : "";
}

function canManageUsers(role: unknown) {
  const normalized = sanitizeText(role, 20);
  return normalized === "ADMIN" || normalized === "MANAGER";
}

function serializeUser(user: {
  _id: { toString: () => string };
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}

export async function GET(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get("role");

    if (!canManageUsers(role)) {
      return NextResponse.json({ ok: false, error: "Manager or admin access is required." }, { status: 403 });
    }

    await connectToDatabase();

    const normalizedRole = sanitizeText(role, 20);
    const query = normalizedRole === "ADMIN" ? { role: { $in: ["CLEANER", "MANAGER", "ADMIN"] } } : { role: "CLEANER" };
    const users = await User.find(query).sort({ role: 1, name: 1 }).lean();

    return NextResponse.json({
      ok: true,
      users: users.map(serializeUser),
    });
  } catch (error) {
    console.error("Admin users GET failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load users." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorRole = sanitizeText(body.role, 20);

    if (!canManageUsers(actorRole)) {
      return NextResponse.json({ ok: false, error: "Manager or admin access is required." }, { status: 403 });
    }

    const name = sanitizeText(body.name);
    const email = sanitizeEmail(body.email);
    const password = sanitizePassword(body.password);
    const targetRole = sanitizeText(body.userRole, 20) as UserRole;
    const allowedTargetRole = actorRole === "ADMIN" ? targetRole : "CLEANER";

    if (!name || !email || !password) {
      return NextResponse.json({ ok: false, error: "Name, email, and password are required." }, { status: 400 });
    }

    if (!["CLEANER", "MANAGER", "ADMIN"].includes(allowedTargetRole)) {
      return NextResponse.json({ ok: false, error: "Invalid user role." }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.create({
      name,
      email,
      password: hashPassword(password),
      role: allowedTargetRole,
      active: true,
    });

    return NextResponse.json({
      ok: true,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Admin users POST failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create user." },
      { status: 500 },
    );
  }
}

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { hashPassword } from "@/lib/password";
import User from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRole = "CLEANER" | "MANAGER" | "ADMIN";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

function sanitizeText(value: unknown, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function sanitizeEmail(value: unknown) {
  return sanitizeText(value, 180).toLowerCase();
}

function sanitizePassword(value: unknown) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) : "";
}

function isAdminRole(role: unknown) {
  return sanitizeText(role, 20) === "ADMIN";
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const body = await request.json();
    const actorRole = sanitizeText(body.role, 20);

    if (!isAdminRole(actorRole)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ ok: false, error: "Invalid user id." }, { status: 400 });
    }

    const name = sanitizeText(body.name);
    const email = sanitizeEmail(body.email);
    const password = sanitizePassword(body.password);
    const active = typeof body.active === "boolean" ? body.active : true;
    const requestedRole = sanitizeText(body.userRole, 20) as UserRole;

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: "Name and email are required." }, { status: 400 });
    }

    if (!["CLEANER", "MANAGER", "ADMIN"].includes(requestedRole)) {
      return NextResponse.json({ ok: false, error: "Invalid user role." }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.findById(userId);

    if (!existing) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    existing.name = name;
    existing.email = email;
    existing.role = requestedRole;
    existing.active = active;

    if (password) {
      existing.password = hashPassword(password);
    }

    await existing.save();

    return NextResponse.json({
      ok: true,
      user: serializeUser(existing),
    });
  } catch (error) {
    console.error("Admin users PATCH failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update user." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const body = await request.json();
    const actorRole = sanitizeText(body.role, 20);

    if (!isAdminRole(actorRole)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ ok: false, error: "Invalid user id." }, { status: 400 });
    }

    await connectToDatabase();

    const existing = await User.findById(userId);

    if (!existing) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    existing.active = false;
    await existing.save();

    return NextResponse.json({
      ok: true,
      user: serializeUser(existing),
    });
  } catch (error) {
    console.error("Admin users DELETE failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to deactivate user." },
      { status: 500 },
    );
  }
}

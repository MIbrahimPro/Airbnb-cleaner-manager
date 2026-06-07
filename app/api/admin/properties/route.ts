import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PropertyTask = {
  taskName: string;
  referenceImageUrl: string;
};

function sanitizeText(value: unknown, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function isAdminRole(value: unknown) {
  return sanitizeText(value, 20) === "ADMIN";
}

function serializeProperty(property: {
  _id: { toString: () => string };
  name: string;
  coverImage?: string;
  tasks?: PropertyTask[];
}) {
  return {
    id: property._id.toString(),
    name: property.name,
    coverImage: property.coverImage ?? "",
    taskCount: property.tasks?.length ?? 0,
    tasks: (property.tasks ?? []).map((task, index) => ({
      id: `${property._id.toString()}-${index}`,
      taskName: task.taskName,
      referenceImageUrl: task.referenceImageUrl,
    })),
  };
}

export async function GET(request: Request) {
  try {
    const role = new URL(request.url).searchParams.get("role");

    if (!isAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    await connectToDatabase();

    const properties = await Property.find({}).sort({ name: 1 }).lean();

    return NextResponse.json({
      ok: true,
      properties: properties.map(serializeProperty),
    });
  } catch (error) {
    console.error("Admin properties GET failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load admin properties." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!isAdminRole(body.role)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    const name = sanitizeText(body.name);
    const coverImage = sanitizeText(body.coverImage, 2000);

    if (!name) {
      return NextResponse.json({ ok: false, error: "Property name is required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.create({
      name,
      coverImage,
      tasks: [],
    });

    return NextResponse.json({
      ok: true,
      property: serializeProperty(property),
    });
  } catch (error) {
    console.error("Admin properties POST failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create property." },
      { status: 500 },
    );
  }
}

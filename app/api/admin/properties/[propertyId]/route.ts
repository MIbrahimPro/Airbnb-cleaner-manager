import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    propertyId: string;
  }>;
};

function sanitizeText(value: unknown, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function isAdminRole(value: unknown) {
  return sanitizeText(value, 20) === "ADMIN";
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;
    const body = await request.json();

    if (!isAdminRole(body.role)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    const name = sanitizeText(body.name);
    const coverImage = sanitizeText(body.coverImage, 2000);

    if (!name) {
      return NextResponse.json({ ok: false, error: "Property name is required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findByIdAndUpdate(
      propertyId,
      {
        $set: {
          name,
          coverImage,
        },
      },
      { new: true },
    ).lean();

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property._id.toString(),
        name: property.name,
        coverImage: property.coverImage,
      },
    });
  } catch (error) {
    console.error("Admin property PATCH failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update property." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;
    const body = await request.json();

    if (!isAdminRole(body.role)) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findByIdAndDelete(propertyId);

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    await CleanSession.deleteMany({ propertyId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin property DELETE failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to delete property." },
      { status: 500 },
    );
  }
}

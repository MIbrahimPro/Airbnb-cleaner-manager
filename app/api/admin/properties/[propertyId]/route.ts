import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getCloudinary } from "@/lib/cloudinary";
import connectToDatabase from "@/lib/db";
import { validateImageUpload } from "@/lib/image-upload";
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

async function uploadCoverImage(file: File, propertyId: string, propertyName: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise<string>((resolve, reject) => {
    const cloudinary = getCloudinary();
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `cleaner-qc/property-covers/${propertyId}`,
        public_id: `${propertyName}-${Date.now()}`,
        resource_type: "image",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary cover upload failed."));
          return;
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(buffer);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;
    const formData = await request.formData();

    if (!isAdminRole(formData.get("role"))) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    const name = sanitizeText(formData.get("name"));
    const coverFile = formData.get("coverFile");

    if (!name) {
      return NextResponse.json({ ok: false, error: "Property name is required." }, { status: 400 });
    }

    await connectToDatabase();

    const existingProperty = await Property.findById(propertyId);

    if (!existingProperty) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    existingProperty.name = name;

    if (coverFile instanceof File && coverFile.size > 0) {
      const fileError = validateImageUpload(coverFile, "Cover image");

      if (fileError) {
        return NextResponse.json({ ok: false, error: fileError }, { status: 400 });
      }

      existingProperty.coverImage = await uploadCoverImage(coverFile, propertyId, name);
    }

    await existingProperty.save();

    return NextResponse.json({
      ok: true,
      property: {
        id: existingProperty._id.toString(),
        name: existingProperty.name,
        coverImage: existingProperty.coverImage,
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

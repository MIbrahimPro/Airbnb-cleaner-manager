import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCloudinary } from "@/lib/cloudinary";
import connectToDatabase from "@/lib/db";
import ImageHashLog from "@/models/ImageHashLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const maxUploadBytes = 5 * 1024 * 1024;

function bufferToDataUri(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function sanitizeCleanerName(value: FormDataEntryValue | null) {
  return typeof value === "string"
    ? value
        .replace(/[^\p{L}\p{N}\s'-]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function sanitizeLabel(value: FormDataEntryValue | null, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function isSameUtcDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const cleanerName = sanitizeCleanerName(formData.get("cleanerName"));
    const propertyName = sanitizeLabel(formData.get("propertyName"), "property");
    const taskName = sanitizeLabel(formData.get("taskName"), "task");

    if (!cleanerName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cleaner name is required.",
        },
        { status: 400 },
      );
    }

    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid image file is required.",
        },
        { status: 400 },
      );
    }

    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: "Image is too large. Please use a smaller or compressed photo.",
        },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = createHash("sha256").update(buffer).digest("hex");

    await connectToDatabase();

    const existingHash = await ImageHashLog.findOne({ hash }).lean();
    const now = new Date();

    if (existingHash && !isSameUtcDay(new Date(existingHash.uploadedAt), now)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This photo was already used on a previous day. Please take a new live photo.",
        },
        { status: 400 },
      );
    }

    const cloudinary = getCloudinary();
    const uploadResult = await cloudinary.uploader.upload(bufferToDataUri(buffer, file.type), {
      folder: "cleaner-qc/live",
      resource_type: "image",
      context: {
        cleanerName,
        propertyName,
        taskName,
      },
    });

    if (!existingHash) {
      await ImageHashLog.create({
        hash,
        uploadedAt: now,
        cleanerName,
      });
    }

    return NextResponse.json({
      ok: true,
      hash,
      liveImageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error) {
    console.error("Upload task route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 500 },
    );
  }
}

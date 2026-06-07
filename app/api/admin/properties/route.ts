import { NextResponse } from "next/server";
import { getCloudinary } from "@/lib/cloudinary";
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

function getCoverPriority(taskName: string) {
  const normalized = taskName.toLowerCase();

  if (/\b(cover|hero|front|main)\b/.test(normalized)) {
    return 0;
  }

  if (/\b(outdoor|outside|exterior|garden|patio|balcony|terrace|entrance|street|driveway|front)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(living|lounge|sitting|reception)\b/.test(normalized)) {
    return 2;
  }

  if (/\b(bed|bedroom|master)\b/.test(normalized)) {
    return 3;
  }

  return 4;
}

function resolvePropertyCover(coverImage: string, tasks: PropertyTask[]) {
  const taskUrls = new Set(tasks.map((task) => task.referenceImageUrl));

  if (coverImage && !taskUrls.has(coverImage)) {
    return coverImage;
  }

  return [...tasks].sort((a, b) => getCoverPriority(a.taskName) - getCoverPriority(b.taskName))[0]?.referenceImageUrl ?? "";
}

async function uploadCoverImage(file: File, propertyName: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise<string>((resolve, reject) => {
    const cloudinary = getCloudinary();
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "cleaner-qc/property-covers",
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

function serializeProperty(property: {
  _id: { toString: () => string };
  name: string;
  coverImage?: string;
  tasks?: PropertyTask[];
}) {
  return {
    id: property._id.toString(),
    name: property.name,
    coverImage: resolvePropertyCover(property.coverImage ?? "", property.tasks ?? []),
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
    const formData = await request.formData();

    if (!isAdminRole(formData.get("role"))) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    const name = sanitizeText(formData.get("name"));
    const coverFile = formData.get("coverFile");

    if (!name) {
      return NextResponse.json({ ok: false, error: "Property name is required." }, { status: 400 });
    }

    const coverImage = coverFile instanceof File && coverFile.size > 0 ? await uploadCoverImage(coverFile, name) : "";

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

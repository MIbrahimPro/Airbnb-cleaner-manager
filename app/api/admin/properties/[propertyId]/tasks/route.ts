import mongoose from "mongoose";
import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    propertyId: string;
  }>;
};

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

async function uploadReferenceImage(file: File, propertyId: string, taskName: string) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `cleaner-qc/admin-references/${propertyId}`,
        public_id: `${taskName}-${Date.now()}`,
        resource_type: "image",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(buffer);
  });
}

function serializeTasks(propertyId: string, tasks: PropertyTask[]) {
  return tasks.map((task, index) => ({
    id: `${propertyId}-${index}`,
    taskName: task.taskName,
    referenceImageUrl: task.referenceImageUrl,
  }));
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;
    const formData = await request.formData();

    if (!isAdminRole(formData.get("role"))) {
      return NextResponse.json({ ok: false, error: "Admin access is required." }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    const taskName = sanitizeText(formData.get("taskName"));
    const referenceImageUrl = sanitizeText(formData.get("referenceImageUrl"), 2000);
    const file = formData.get("file");

    if (!taskName) {
      return NextResponse.json({ ok: false, error: "Place name is required." }, { status: 400 });
    }

    if (!referenceImageUrl && !(file instanceof File && file.size > 0)) {
      return NextResponse.json({ ok: false, error: "Reference image URL or upload is required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findById(propertyId);

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    if (property.tasks.some((task: PropertyTask) => task.taskName.toLowerCase() === taskName.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "This place already exists." }, { status: 400 });
    }

    const resolvedReference =
      file instanceof File && file.size > 0 ? await uploadReferenceImage(file, propertyId, taskName) : referenceImageUrl;

    property.tasks.push({
      taskName,
      referenceImageUrl: resolvedReference,
    });

    if (!property.coverImage) {
      property.coverImage = resolvedReference;
    }

    await property.save();

    return NextResponse.json({
      ok: true,
      tasks: serializeTasks(property._id.toString(), property.tasks),
    });
  } catch (error) {
    console.error("Admin task POST failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create place." },
      { status: 500 },
    );
  }
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

    const previousTaskName = sanitizeText(formData.get("previousTaskName"));
    const taskName = sanitizeText(formData.get("taskName"));
    const referenceImageUrl = sanitizeText(formData.get("referenceImageUrl"), 2000);
    const file = formData.get("file");

    if (!previousTaskName || !taskName) {
      return NextResponse.json({ ok: false, error: "Current and new place names are required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findById(propertyId);

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    const task = property.tasks.find((item: PropertyTask) => item.taskName === previousTaskName);

    if (!task) {
      return NextResponse.json({ ok: false, error: "Place not found." }, { status: 404 });
    }

    const duplicateName = property.tasks.some(
      (item: PropertyTask) => item.taskName !== previousTaskName && item.taskName.toLowerCase() === taskName.toLowerCase(),
    );

    if (duplicateName) {
      return NextResponse.json({ ok: false, error: "Another place already uses this name." }, { status: 400 });
    }

    task.taskName = taskName;

    if (file instanceof File && file.size > 0) {
      task.referenceImageUrl = await uploadReferenceImage(file, propertyId, taskName);
    } else if (referenceImageUrl) {
      task.referenceImageUrl = referenceImageUrl;
    }

    await property.save();

    return NextResponse.json({
      ok: true,
      tasks: serializeTasks(property._id.toString(), property.tasks),
    });
  } catch (error) {
    console.error("Admin task PATCH failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to update place." },
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

    const taskName = sanitizeText(body.taskName);

    if (!taskName) {
      return NextResponse.json({ ok: false, error: "Place name is required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findById(propertyId);

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    property.tasks = property.tasks.filter((task: PropertyTask) => task.taskName !== taskName);
    await property.save();

    return NextResponse.json({
      ok: true,
      tasks: serializeTasks(property._id.toString(), property.tasks),
    });
  } catch (error) {
    console.error("Admin task DELETE failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to delete place." },
      { status: 500 },
    );
  }
}

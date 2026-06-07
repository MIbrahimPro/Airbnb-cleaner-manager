import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCloudinary } from "@/lib/cloudinary";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);
const BASE_IMAGES_DIR = path.join(process.cwd(), "assets", "base images");

function extensionlessName(fileName: string) {
  return path.basename(fileName, path.extname(fileName));
}

function toCloudinaryPublicId(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
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

function selectCoverImage(tasks: { taskName: string; referenceImageUrl: string }[]) {
  return [...tasks].sort((a, b) => getCoverPriority(a.taskName) - getCoverPriority(b.taskName))[0]?.referenceImageUrl ?? "";
}

async function getPropertyDirectories() {
  const entries = await readdir(BASE_IMAGES_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function getImageFiles(propertyName: string) {
  const propertyDir = path.join(BASE_IMAGES_DIR, propertyName);
  const entries = await readdir(propertyDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function seedPropertiesFromAssets() {
  await connectToDatabase();

  const propertyNames = await getPropertyDirectories();
  const seededProperties = [];

  for (const propertyName of propertyNames) {
    const imageFiles = await getImageFiles(propertyName);
    const tasks = [];

    for (const imageFile of imageFiles) {
      const taskName = extensionlessName(imageFile);
      const imagePath = path.join(BASE_IMAGES_DIR, propertyName, imageFile);
      const publicId = [
        "cleaner-qc",
        "reference",
        toCloudinaryPublicId(propertyName),
        toCloudinaryPublicId(taskName),
      ].join("/");

      const cloudinary = getCloudinary();
      const uploadResult = await cloudinary.uploader.upload(imagePath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      tasks.push({
        taskName,
        referenceImageUrl: uploadResult.secure_url,
      });
    }

    const coverImage = selectCoverImage(tasks);
    const property = await Property.findOneAndUpdate(
      { name: propertyName },
      {
        $set: {
          name: propertyName,
          coverImage,
          tasks,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      },
    ).lean();

    seededProperties.push({
      id: property._id.toString(),
      name: property.name,
      coverImage: property.coverImage,
      taskCount: property.tasks.length,
    });
  }

  return {
    propertyCount: seededProperties.length,
    taskCount: seededProperties.reduce((total, property) => total + property.taskCount, 0),
    properties: seededProperties,
  };
}

export async function GET() {
  try {
    const result = await seedPropertiesFromAssets();
    return NextResponse.json({
      ok: true,
      message: "Seed completed.",
      ...result,
    });
  } catch (error) {
    console.error("Seed route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Seed failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  return GET();
}

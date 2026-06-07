import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PropertyTask = {
  taskName: string;
  referenceImageUrl: string;
};

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

export async function GET() {
  try {
    await connectToDatabase();

    const properties = await Property.find({})
      .sort({ name: 1 })
      .select({ name: 1, coverImage: 1, tasks: 1 })
      .lean();

    return NextResponse.json({
      ok: true,
      properties: properties.map((property) => ({
        id: property._id.toString(),
        name: property.name,
        coverImage: resolvePropertyCover(property.coverImage, property.tasks),
        taskCount: property.tasks.length,
      })),
    });
  } catch (error) {
    console.error("Properties route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load properties.",
      },
      { status: 500 },
    );
  }
}

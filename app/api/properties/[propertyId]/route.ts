import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PropertyTaskDocument = {
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

function resolvePropertyCover(coverImage: string, tasks: PropertyTaskDocument[]) {
  const taskUrls = new Set(tasks.map((task) => task.referenceImageUrl));

  if (coverImage && !taskUrls.has(coverImage)) {
    return coverImage;
  }

  return [...tasks].sort((a, b) => getCoverPriority(a.taskName) - getCoverPriority(b.taskName))[0]?.referenceImageUrl ?? "";
}

type RouteContext = {
  params: Promise<{
    propertyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { propertyId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid property id.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const property = await Property.findById(propertyId).lean();

    if (!property) {
      return NextResponse.json(
        {
          ok: false,
          error: "Property not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      property: {
        id: property._id.toString(),
        name: property.name,
        coverImage: resolvePropertyCover(property.coverImage, property.tasks),
        tasks: property.tasks.map((task: PropertyTaskDocument, index: number) => ({
          id: `${property._id.toString()}-${index}`,
          taskName: task.taskName,
          referenceImageUrl: task.referenceImageUrl,
        })),
      },
    });
  } catch (error) {
    console.error("Property detail route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load property.",
      },
      { status: 500 },
    );
  }
}

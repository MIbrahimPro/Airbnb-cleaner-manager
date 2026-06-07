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
        coverImage: property.coverImage,
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

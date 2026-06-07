import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        coverImage: property.coverImage,
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


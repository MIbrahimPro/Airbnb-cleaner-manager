import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeText(value: string | null) {
  return value?.trim().slice(0, 200) ?? "";
}

function isResolvedTask(task: { status: string; appealed?: boolean }) {
  return task.status === "PASS" || (task.status === "FAIL" && task.appealed);
}

type CompletedTask = {
  taskName: string;
  status: string;
  appealed?: boolean;
  aiFeedback?: string;
  liveImageUrl?: string;
};

type PropertyTask = {
  taskName: string;
};

export async function GET(request: NextRequest) {
  try {
    const propertyId = sanitizeText(request.nextUrl.searchParams.get("propertyId"));
    const cleanerName = sanitizeText(request.nextUrl.searchParams.get("cleanerName"));

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    if (!cleanerName) {
      return NextResponse.json({ ok: false, error: "cleanerName is required." }, { status: 400 });
    }

    await connectToDatabase();

    const property = await Property.findById(propertyId).lean();

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    const session = await CleanSession.findOne({
      propertyId,
      cleanerName,
    })
      .sort({ finalized: 1, updatedAt: -1 })
      .lean();

    const completedTasks = (session?.tasksCompleted ?? []) as CompletedTask[];
    const taskMap = new Map(completedTasks.map((task) => [task.taskName, task] as const));
    const tasks = (property.tasks as PropertyTask[]).map((task) => {
      const completedTask = taskMap.get(task.taskName);
      return {
        taskName: task.taskName,
        status: completedTask?.status ?? "PENDING",
        appealed: completedTask?.appealed ?? false,
        aiFeedback: completedTask?.aiFeedback ?? "",
        liveImageUrl: completedTask?.liveImageUrl ?? "",
      };
    });
    const resolvedCount = tasks.filter(isResolvedTask).length;
    const canFinalize = tasks.length > 0 && resolvedCount === tasks.length;

    return NextResponse.json({
      ok: true,
      session: session
        ? {
            id: session._id.toString(),
            totalScore: session.totalScore,
            finalized: session.finalized,
            resolvedCount,
            taskCount: tasks.length,
            canFinalize,
            tasks,
          }
        : {
            id: "",
            totalScore: 100,
            finalized: false,
            resolvedCount: 0,
            taskCount: tasks.length,
            canFinalize: false,
            tasks,
          },
    });
  } catch (error) {
    console.error("Session status route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load session status.",
      },
      { status: 500 },
    );
  }
}

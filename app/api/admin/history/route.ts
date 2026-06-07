import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompletedTask = {
  taskName: string;
  status: string;
  appealed?: boolean;
  aiFeedback?: string;
  liveImageUrl?: string;
};

function sanitizeText(value: unknown, limit = 200) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function canViewHistory(role: unknown) {
  const normalized = sanitizeText(role, 20);
  return normalized === "ADMIN" || normalized === "MANAGER";
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const role = params.get("role");
    const cleanerName = sanitizeText(params.get("cleanerName"));

    if (!canViewHistory(role)) {
      return NextResponse.json({ ok: false, error: "Manager or admin access is required." }, { status: 403 });
    }

    await connectToDatabase();

    const query = cleanerName ? { cleanerName } : {};
    const sessions = await CleanSession.find(query).sort({ updatedAt: -1 }).limit(80).lean();
    const propertyIds = Array.from(new Set(sessions.map((session) => session.propertyId.toString())));
    const properties = await Property.find({ _id: { $in: propertyIds } }).select({ name: 1 }).lean();
    const propertyMap = new Map(properties.map((property) => [property._id.toString(), property.name]));

    return NextResponse.json({
      ok: true,
      sessions: sessions.map((session) => {
        const tasks = (session.tasksCompleted ?? []) as CompletedTask[];
        const failedTasks = tasks.filter((task) => task.status === "FAIL");

        return {
          id: session._id.toString(),
          cleanerName: session.cleanerName,
          propertyId: session.propertyId.toString(),
          propertyName: propertyMap.get(session.propertyId.toString()) ?? "Deleted property",
          totalScore: session.totalScore,
          finalized: session.finalized,
          updatedAt: session.updatedAt?.toISOString?.() ?? "",
          taskCount: tasks.length,
          failedCount: failedTasks.length,
          appealedCount: tasks.filter((task) => task.appealed).length,
          failedTasks: failedTasks.map((task) => ({
            taskName: task.taskName,
            appealed: Boolean(task.appealed),
            aiFeedback: task.aiFeedback ?? "",
            liveImageUrl: task.liveImageUrl ?? "",
          })),
        };
      }),
    });
  } catch (error) {
    console.error("Admin history GET failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load cleaner history." },
      { status: 500 },
    );
  }
}

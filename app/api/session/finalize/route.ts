import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";
import Property from "@/models/Property";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function isResolvedTask(task: { status: string; appealed?: boolean }) {
  return task.status === "PASS" || (task.status === "FAIL" && task.appealed);
}

type CompletedTask = {
  taskName: string;
  status: string;
  appealed?: boolean;
};

type PropertyTask = {
  taskName: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = sanitizeText(body.sessionId);

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
    }

    await connectToDatabase();

    const session = await CleanSession.findById(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const property = await Property.findById(session.propertyId).lean();

    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    const completedMap = new Map(
      (session.tasksCompleted as CompletedTask[]).map((task) => [task.taskName, task] as const),
    );
    const allResolved = (property.tasks as PropertyTask[]).every((task) => {
      const completedTask = completedMap.get(task.taskName);
      return completedTask ? isResolvedTask(completedTask) : false;
    });

    if (!allResolved) {
      return NextResponse.json(
        {
          ok: false,
          error: "All property tasks must be passed or locked after final fail before finalizing.",
        },
        { status: 400 },
      );
    }

    session.finalized = true;
    await session.save();

    return NextResponse.json({
      ok: true,
      session: {
        id: session._id.toString(),
        totalScore: session.totalScore,
        finalized: session.finalized,
      },
    });
  } catch (error) {
    console.error("Finalize session route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to finalize session.",
      },
      { status: 500 },
    );
  }
}

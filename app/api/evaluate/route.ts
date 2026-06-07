import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getAiClient, getAiConfig } from "@/lib/ai";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EvaluationStatus = "PASS" | "FAIL";

type EvaluationResult = {
  status: EvaluationStatus;
  feedback: string;
};

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : fallback;
}

function parseEvaluationJson(content: string): EvaluationResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  const status = parsed.status === "PASS" ? "PASS" : "FAIL";

  return {
    status,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
  };
}

async function upsertEvaluationTask({
  propertyId,
  cleanerName,
  taskName,
  liveImageUrl,
  referenceImageUrl,
  cleanerNotes,
  result,
}: {
  propertyId: string;
  cleanerName: string;
  taskName: string;
  liveImageUrl: string;
  referenceImageUrl: string;
  cleanerNotes: string;
  result: EvaluationResult;
}) {
  let session = await CleanSession.findOne({
    propertyId,
    cleanerName,
    finalized: false,
  });

  if (!session) {
    session = await CleanSession.create({
      propertyId,
      cleanerName,
      date: new Date(),
      tasksCompleted: [],
    });
  }

  const existingTask = session.tasksCompleted.find((task: { taskName: string }) => task.taskName === taskName);

  if (existingTask) {
    if (existingTask.appealed) {
      throw new Error("This task has already completed final review and is locked.");
    }

    existingTask.liveImageUrl = liveImageUrl;
    existingTask.referenceImageUrl = referenceImageUrl;
    existingTask.status = result.status;
    existingTask.aiFeedback = result.feedback;
    existingTask.cleanerNotes = cleanerNotes;
    existingTask.appealed = false;
  } else {
    session.tasksCompleted.push({
      taskName,
      liveImageUrl,
      referenceImageUrl,
      status: result.status,
      aiFeedback: result.feedback,
      cleanerNotes,
      appealed: false,
    });
  }

  await session.save();
  return session;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const propertyId = sanitizeText(body.propertyId);
    const cleanerName = sanitizeText(body.cleanerName);
    const taskName = sanitizeText(body.taskName);
    const liveImageUrl = sanitizeText(body.liveImageUrl);
    const referenceImageUrl = sanitizeText(body.referenceImageUrl);
    const cleanerNotes = sanitizeText(body.cleanerNotes);

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return NextResponse.json({ ok: false, error: "Invalid property id." }, { status: 400 });
    }

    if (!cleanerName || !taskName || !liveImageUrl || !referenceImageUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "cleanerName, taskName, liveImageUrl, and referenceImageUrl are required.",
        },
        { status: 400 },
      );
    }

    const aiConfig = getAiConfig();
    const aiClient = getAiClient();
    const completion = await aiClient.chat.completions.create({
      model: aiConfig.baseModel,
      messages: [
        {
          role: "system",
          content:
            "You are a strict short-term rental cleaning QA manager. Compare the reference image and the live cleaner submission for the same property place/task. Fail the submission if the live image appears to show the wrong room, wrong property, wrong angle with insufficient evidence, a screenshot/old photo, a blurry/blocked image, or an unrelated object/area. Also fail if cleanliness or presentation is below guest-ready standard: visible dirt, hair, stains, trash, wet surfaces, clutter, missed supplies, poor staging, items not returned to the reference layout, incorrect/missing pillow covers or linens, messy pillows, towels not folded/placed correctly, unmade beds, dirty bathroom fixtures, dirty kitchen surfaces, floors not cleaned, mirrors/glass streaked, bins not emptied, or safety/maintenance issues visible. Be fair about small harmless differences in angle, lighting, or decor, but do not pass when the task cannot be verified clearly. Return ONLY valid JSON with this exact shape: { \"status\": \"PASS\" or \"FAIL\", \"feedback\": \"Specific reason if failed, empty if passed\" }.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Task: ${taskName}. First image is the reference. Second image is the live cleaner submission. Cleaner notes or reported issues: ${cleanerNotes || "None provided."}`,
            },
            {
              type: "image_url",
              image_url: {
                url: referenceImageUrl,
              },
            },
            {
              type: "image_url",
              image_url: {
                url: liveImageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned an empty response.");
    }

    const result = parseEvaluationJson(content);

    await connectToDatabase();
    const session = await upsertEvaluationTask({
      propertyId,
      cleanerName,
      taskName,
      liveImageUrl,
      referenceImageUrl,
      cleanerNotes,
      result,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session._id.toString(),
      model: aiConfig.baseModel,
      result,
    });
  } catch (error) {
    console.error("Evaluate route failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Evaluation failed.",
      },
      { status: 500 },
    );
  }
}

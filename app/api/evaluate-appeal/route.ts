import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { fetchImageAsDataUrl, getAiAuthErrorMessage, getAiClient, getAiConfig } from "@/lib/ai";
import connectToDatabase from "@/lib/db";
import CleanSession from "@/models/CleanSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AppealStatus = "PASS" | "FAIL";

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : fallback;
}

function parseAppealJson(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  const status: AppealStatus = parsed.status === "PASS" ? "PASS" : "FAIL";

  return {
    status,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = sanitizeText(body.sessionId);
    const taskName = sanitizeText(body.taskName);

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 });
    }

    if (!taskName) {
      return NextResponse.json({ ok: false, error: "taskName is required." }, { status: 400 });
    }

    await connectToDatabase();

    const session = await CleanSession.findById(sessionId);

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const task = session.tasksCompleted.find((item: { taskName: string }) => item.taskName === taskName);

    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found in session." }, { status: 404 });
    }

    if (task.appealed) {
      return NextResponse.json(
        {
          ok: false,
          error: "This task has already been appealed.",
        },
        { status: 400 },
      );
    }

    const aiConfig = getAiConfig();
    const aiClient = getAiClient();
    const [referenceImageDataUrl, liveImageDataUrl] = await Promise.all([
      fetchImageAsDataUrl(task.referenceImageUrl),
      fetchImageAsDataUrl(task.liveImageUrl),
    ]);
    const completion = await aiClient.chat.completions.create({
      model: aiConfig.appealModel,
      messages: [
        {
          role: "system",
          content:
            "You are a Senior short-term rental QA Reviewer handling an appeal after an initial cleaning failure. Perform a rigorous second pass comparing the reference image and the live cleaner submission for the same property place/task. Only overturn to PASS when the live image clearly proves the correct area is guest-ready. Keep or set FAIL if the image is the wrong room, wrong property, unrelated area/object, screenshot/old photo, too blurry, too dark, too cropped, blocked, or taken from an angle that prevents verification. Keep or set FAIL for visible dirt, hair, stains, trash, wet surfaces, clutter, missed supplies, poor staging, items not returned to the expected layout, incorrect/missing pillow covers or linens, messy pillows, towels not folded/placed correctly, unmade beds, dirty bathroom fixtures, dirty kitchen surfaces, unclean floors, streaked mirrors/glass, bins not emptied, or visible safety/maintenance concerns. Be fair about harmless angle, lighting, and minor decor differences, but protect guest quality and do not rely on assumptions. Return ONLY valid JSON with this exact shape: { \"status\": \"PASS\" or \"FAIL\", \"feedback\": \"Specific reason if failed, empty if passed\" }.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Appeal review for task: ${taskName}. First image is the reference. Second image is the live cleaner submission. Cleaner notes or reported issues: ${task.cleanerNotes || "None provided."}`,
            },
            {
              type: "image_url",
              image_url: referenceImageDataUrl,
            },
            {
              type: "image_url",
              image_url: liveImageDataUrl,
            },
          ] as never,
        },
      ],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned an empty appeal response.");
    }

    const result = parseAppealJson(content);
    task.appealed = true;
    task.status = result.status;
    task.aiFeedback = result.feedback;

    if (result.status === "FAIL") {
      session.totalScore = Math.max(0, session.totalScore - 5);
    }

    await session.save();

    return NextResponse.json({
      ok: true,
      model: aiConfig.appealModel,
      result,
      totalScore: session.totalScore,
    });
  } catch (error) {
    console.error("Evaluate appeal route failed:", error);
    const aiAuthError = getAiAuthErrorMessage(error);

    return NextResponse.json(
      {
        ok: false,
        error: aiAuthError ?? (error instanceof Error ? error.message : "Appeal evaluation failed."),
      },
      { status: aiAuthError ? 401 : 500 },
    );
  }
}

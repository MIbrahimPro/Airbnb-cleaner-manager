# AI-Powered Cleaner QA System - Development Blueprint

## Tech Stack

- **Frontend:** Next.js App Router, Tailwind CSS, Lucide React (Premium, Apple-inspired mobile UI)
- **Backend:** Next.js API Routes, Mongoose (MongoDB)
- **Storage:** Cloudinary (Direct SDK uploads)
- **AI:** Ollama Cloud via OpenAI Node SDK wrapper (Vision Models)

## Core Directives for AI Assistant

- **Sequential Execution:** Do NOT skip steps. Complete one phase entirely before moving to the next.
- **UI Consistency:** Maintain the existing minimalist, high-end Apple-inspired design system.
- **Robust Error Handling:** All API routes must have standard try/catch blocks and return clean JSON error messages.
- **Human Oversight:** The system must not rely 100% on AI scoring. Admin/manager review tools are required.
- **Phase Tracking:** When a phase is fully implemented and verified, mark it as complete in this file.

## Phase 1: Environment & Config Initialization - DONE

- [x] Verify `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `OLLAMA_KEY` are in the `.env` or `.env.local` file.
- [x] Install required packages: `mongoose`, `cloudinary`, `openai` (used as a wrapper for Ollama), `crypto` (built-in Node module).
- [x] Create a centralized `lib/db.ts` file to handle the MongoDB connection cleanly.
- [x] Create a `lib/cloudinary.ts` file to configure the Cloudinary v2 SDK.
- [x] Create a `lib/ai.ts` file.
- [x] Make OpenAI migration easy through env-driven provider/model config.

Crucial: Initialize the OpenAI client to point to the Ollama Cloud endpoint by default:

```ts
import OpenAI from "openai";

const aiClient = new OpenAI({
  baseURL: "https://api.ollama.com/v1",
  apiKey: process.env.OLLAMA_KEY,
});

export default aiClient;
```

## Phase 2: Database Schema (Mongoose Models) - DONE

- [x] Create `models/Property.js`: `{ name: String, coverImage: String, tasks: [{ taskName: String, referenceImageUrl: String }] }`
- [x] Create `models/CleanSession.js`: `{ propertyId, cleanerName, date, totalScore: { type: Number, default: 100 }, tasksCompleted: [{ taskName, liveImageUrl, status: { type: String, enum: ['PENDING', 'PASS', 'FAIL'] }, aiFeedback: String, appealed: { type: Boolean, default: false } }] }`
- [x] Create `models/ImageHashLog.js`: `{ hash: { type: String, unique: true }, uploadedAt: Date, cleanerName: String }` (Strictly prevents duplicate uploads).

## Phase 3: Dynamic Seeding Script (from Assets) - DONE

- [x] Create an API route `/api/seed` (`GET` or `POST`).
- [x] Create a one-time seed runner so seeding does not depend on a browser/dev server.
- [x] The script must read the local `assets/base images/` directory.
- [x] Iterate through the subdirectories (e.g., `124 St George's rd`, `1 New rd`). The folder name is the `Property.name`.
- [x] Iterate through the images inside each folder (e.g., `Bathroom 1.jpeg`, `Kitchen 1.jpeg`). The filename (without extension) is the `taskName`.
- [x] Upload each image to Cloudinary to get a public URL. Save this as the `referenceImageUrl`.
- [x] Create and save the `Property` document in MongoDB with its array of tasks.
- [x] Seed 5 sample cleaners, 1 manager, and 1 admin user, then print their credentials.

## Phase 4: Frontend UI Flow Implementation - DONE

- [x] Login Screen: Same portal for cleaners, manager, and admin. Use Apple-inspired grouped form UI.
- [x] Home Screen: First show all seeded properties fetched dynamically from MongoDB.
- [x] Places Screen: Clicking a property shows a grid/list of all places/tasks inside that property.
- [x] Inspection Form: Clicking a place/task opens the upload/QA form for that exact place.
- [x] Reference Context: Show the Reference Image thumbnail for each place/task.
- [x] Upload Interface: Drag-and-drop or camera capture live photo upload with mobile-first polish.

## Phase 5: Upload & Anti-Cheat System - DONE

- [x] Create an API route `/api/upload-task`.
- [x] When a live image is submitted, calculate its SHA-256 hash using the raw file buffer.
- [x] Query `ImageHashLog`. If the hash exists, immediately return `400 Bad Request`: `Duplicate Image Detected. Please take a new live photo.`
- [x] If the hash is unique, save it to `ImageHashLog` and upload the buffer directly to Cloudinary. Return the public Cloudinary URL.

## Phase 6: AI Evaluation Engine - DONE

- [x] Create an API route `/api/evaluate`. It accepts the new `liveImageUrl` and the `referenceImageUrl`.
- [x] Construct a system prompt: `You are a strict QA manager. Compare the live image to the reference image. Identify dirt, missed items, or poor presentation. Return ONLY a JSON object: { 'status': 'PASS' or 'FAIL', 'feedback': 'Specific reason if failed, empty if passed' }.`
- [x] Send the request using the `aiClient` (Ollama via OpenAI wrapper). Use the base model from env (`AI_MODEL_BASE`) with a safe default.
- [x] Parse the JSON response. Update the `CleanSession` task status in MongoDB.
- [x] Return the result to the frontend. If `FAIL`, display the feedback and allow the user to retake the photo.

## Phase 7: The Appeal System - DONE

- [x] If a task evaluates as `FAIL`, render an `Appeal` button in the UI.
- [x] Create `/api/evaluate-appeal`.
- [x] Use a better model than the base evaluator via env (`AI_MODEL_APPEAL`) with a safe default.
- [x] Send the same images to the AI with a `Senior QA Reviewer` system prompt demanding a highly rigorous second pass.
- [x] If `FAIL`, lock the task (no more appeals allowed; deduct 5 points). If `PASS`, override the original result and restore status.

## Phase 8: Scoring & Session Finalization - DONE

- [x] Once all tasks for a property are `PASS` or locked after final `FAIL`, finalize the session.
- [x] Create a UI element showing the live score (Starts at 100, `-5` per final `FAIL`).
- [x] Lock the session, save the final score to MongoDB, and show a visually appealing `Job Complete` success screen.

## Phase 9: Admin & Manager Portal - DONE

- [x] Admin login uses the same portal.
- [x] Admin can CRUD properties.
- [x] Admin can CRUD places/tasks inside each property.
- [x] Admin can upload, replace, and remove reference images.
- [x] Admin can view cleaner history, session scores, failed tasks, appeals, and AI feedback.
- [x] Manager login uses the same portal.
- [x] Manager can manage cleaners and view cleaner history.
- [x] Manager cannot edit property/place/image CRUD data.
- [x] UI must keep the Apple-inspired grouped settings/admin panel style.

## Phase 10: Git Operations & Clean Up

- [x] Ensure `assets/` and `.env` are listed in `.gitignore`.
- [x] Run `git add .`
- [x] Run `git commit -m "feat: complete backend architecture, ai evaluation, and anti-cheat implementation"`
- [ ] Run `git push` (blocked: the workspace `.git` directory is empty/read-only and the temporary git repo has no configured remote)

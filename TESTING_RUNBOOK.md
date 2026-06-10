# Airbnb Cleaner Manager Testing Runbook

## Seeded Test Accounts

Use the same sign-in page for all roles.

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Cleaner | Aneeq Cleaner | `aneeq.cleaner@example.local` | `Cleaner-1001` |
| Cleaner | Irfan Cleaner | `irfan.cleaner@example.local` | `Cleaner-1002` |
| Cleaner | Lawrence Cleaner | `lawrence.cleaner@example.local` | `Cleaner-1003` |
| Cleaner | Elina Cleaner | `elina.cleaner@example.local` | `Cleaner-1004` |
| Cleaner | Emily Cleaner | `emily.cleaner@example.local` | `Cleaner-1005` |
| Manager | Manager | `manager@example.local` | `Manager-2001` |
| Admin | Admin | `admin@example.local` | `Admin-3001` |

## Required Environment Variables

Set these locally and in Netlify before testing production deploys:

```text
MONGODB_URI
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
AI_PROVIDER=openai
OPENAI_API_KEY
AI_MODEL_BASE=gpt-5.4-mini
AI_MODEL_APPEAL=gpt-5.4
```

OpenAI is the primary provider. Ollama is still available as a fallback by setting:

```text
AI_PROVIDER=ollama
OLLAMA_KEY
AI_BASE_URL=https://ollama.com/v1
OLLAMA_MODEL_BASE=gemma3:4b
OLLAMA_MODEL_APPEAL=llama3.2-vision
```

## Netlify Deployment Notes

AI keys are validated at runtime when `/api/evaluate` or `/api/evaluate-appeal` is called, so a build can complete before AI routes are exercised. If live evaluation returns an authorization error, check the active provider key:

- OpenAI mode: `OPENAI_API_KEY`
- Ollama mode: `OLLAMA_KEY`

Add variables under:

`Site configuration -> Environment variables`

Set them for Builds, Functions, and Runtime, then redeploy.

## Local Setup Procedure

1. Install dependencies:

   ```bash
   npm i
   ```

2. Confirm `.env` contains the required MongoDB, Cloudinary, and AI variables.

3. Seed MongoDB and Cloudinary from local assets:

   ```bash
   npm run seed
   ```

4. Verify seed counts:

   ```bash
   npm run verify:seed
   ```

5. Run locally:

   ```bash
   npm run dev
   ```

6. Build check:

   ```bash
   npm run build
   ```

## Cleaner Testing Procedure

1. Sign in with any cleaner account.
2. Select a property from the properties screen.
3. Select a place/task from the property grid.
4. Review the reference image.
5. Select the type of clean: `Standard Changeover`, `Deep Clean`, or `Owner Stay`.
6. Add a live photo.
7. Add notes for linen issues, missing supplies, maintenance, or anything the AI/human reviewer should consider.
8. Submit the form. Large camera images are compressed in the browser before upload for Netlify compatibility.
9. Review the dedicated result screen. The old floating toast flow is no longer used.
10. Confirm same-day duplicate photo retries are allowed, while older reused photos are rejected.
11. If the AI result is `PASS`, the place becomes resolved.
12. If the AI result is `FAIL`, use `Appeal` from the result screen for a final senior review.
13. After every place is resolved, finalize the session.
14. Confirm the final score starts at 100 and loses 5 points for each final failed appeal.

## Manager Testing Procedure

1. Sign in with `manager@example.local`.
2. Confirm the manager can see cleaners, click a cleaner, and review that cleaner's history and scores.
3. Confirm the manager can see properties, click a property, and review which cleaners visited and when.
4. Confirm the manager can view cleaner session history, scores, failed tasks, appeals, and AI feedback.
5. Confirm the manager does not see add-cleaner controls or property/place/image CRUD controls.

## Admin Testing Procedure

1. Sign in with `admin@example.local`.
2. Confirm the admin sees properties, cleaners, and history.
3. Create, edit, and delete properties.
4. Add, edit, upload/replace reference images for, and delete places/tasks inside a property.
5. Manage cleaners, managers, and admins.
6. View cleaner history, session scores, failed tasks, appeals, and AI feedback.

## AI Prompts

### Base Evaluation Prompt

```text
You are a strict short-term rental cleaning QA manager. Compare the reference image and the live cleaner submission for the same property place/task. Fail the submission if the live image appears to show the wrong room, wrong property, wrong angle with insufficient evidence, a screenshot/old photo, a blurry/blocked image, or an unrelated object/area. Also fail if cleanliness or presentation is below guest-ready standard: visible dirt, hair, stains, trash, wet surfaces, clutter, missed supplies, poor staging, items not returned to the reference layout, incorrect/missing pillow covers or linens, messy pillows, towels not folded/placed correctly, unmade beds, dirty bathroom fixtures, dirty kitchen surfaces, floors not cleaned, mirrors/glass streaked, bins not emptied, or safety/maintenance issues visible. Be fair about small harmless differences in angle, lighting, or decor, but do not pass when the task cannot be verified clearly. Return ONLY valid JSON with this exact shape: { "status": "PASS" or "FAIL", "feedback": "Specific reason if failed, empty if passed" }.
```

User content:

```text
Task: <taskName>. Clean type: <clean type or "Not specified">. First image is the reference. Second image is the live cleaner submission. Cleaner notes or reported issues: <notes or "None provided.">
```

Images sent:

1. `referenceImageUrl`
2. `liveImageUrl`

OpenAI receives AI-optimized Cloudinary JPEG URLs directly (`f_jpg,q_auto:eco,w_1280,c_limit`). Ollama fallback still fetches those optimized URLs and converts them to `data:image/...;base64,...` because that provider path needs inline image data.

Default model:

```text
AI_MODEL_BASE=gpt-5.4-mini
```

### Appeal Prompt

```text
You are a Senior short-term rental QA Reviewer handling an appeal after an initial cleaning failure. Perform a rigorous second pass comparing the reference image and the live cleaner submission for the same property place/task. Only overturn to PASS when the live image clearly proves the correct area is guest-ready. Keep or set FAIL if the image is the wrong room, wrong property, unrelated area/object, screenshot/old photo, too blurry, too dark, too cropped, blocked, or taken from an angle that prevents verification. Keep or set FAIL for visible dirt, hair, stains, trash, wet surfaces, clutter, missed supplies, poor staging, items not returned to the expected layout, incorrect/missing pillow covers or linens, messy pillows, towels not folded/placed correctly, unmade beds, dirty bathroom fixtures, dirty kitchen surfaces, unclean floors, streaked mirrors/glass, bins not emptied, or visible safety/maintenance concerns. Be fair about harmless angle, lighting, and minor decor differences, but protect guest quality and do not rely on assumptions. Return ONLY valid JSON with this exact shape: { "status": "PASS" or "FAIL", "feedback": "Specific reason if failed, empty if passed" }.
```

User content:

```text
Appeal review for task: <taskName>. Clean type: <clean type or "Not specified">. First image is the reference. Second image is the live cleaner submission. Cleaner notes or reported issues: <notes or "None provided.">
```

Images sent:

1. `referenceImageUrl`
2. `liveImageUrl`

OpenAI receives AI-optimized Cloudinary JPEG URLs directly (`f_jpg,q_auto:eco,w_1280,c_limit`). Ollama fallback still fetches those optimized URLs and converts them to `data:image/...;base64,...` because that provider path needs inline image data.

Default model:

```text
AI_MODEL_APPEAL=gpt-5.4
```

## API Routes

Cleaner flow:

- `POST /api/auth/login`
- `GET /api/properties`
- `GET /api/properties/[propertyId]`
- `POST /api/upload-task`
- `POST /api/evaluate`
- `POST /api/evaluate-appeal`
- `GET /api/session/status`
- `POST /api/session/finalize`

Admin/manager flow:

- `GET /api/admin/properties`
- `POST /api/admin/properties`
- `PATCH /api/admin/properties/[propertyId]`
- `DELETE /api/admin/properties/[propertyId]`
- `POST /api/admin/properties/[propertyId]/tasks`
- `PATCH /api/admin/properties/[propertyId]/tasks`
- `DELETE /api/admin/properties/[propertyId]/tasks`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/[userId]`
- `DELETE /api/admin/users/[userId]`
- `GET /api/admin/history`

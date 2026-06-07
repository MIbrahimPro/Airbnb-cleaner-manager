import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import Property from "../models/Property.js";
import User from "../models/User.js";

async function loadEnvFile() {
  const content = await readFile(".env", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  await loadEnvFile();
  await mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
  });

  const propertyCount = await Property.countDocuments();
  const taskCountResult = await Property.aggregate([
    { $project: { taskCount: { $size: "$tasks" } } },
    { $group: { _id: null, total: { $sum: "$taskCount" } } },
  ]);
  const userCounts = await User.aggregate([
    { $group: { _id: "$role", total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(
    JSON.stringify(
      {
        propertyCount,
        taskCount: taskCountResult[0]?.total ?? 0,
        userCounts,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed verification failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});


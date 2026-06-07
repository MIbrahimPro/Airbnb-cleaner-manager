import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Property from "../models/Property.js";
import User from "../models/User.js";
import { hashPassword } from "../lib/password.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const baseImagesDir = path.join(rootDir, "assets", "base images");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);

const sampleUsers = [
  { name: "Aneeq", email: "aneeq.cleaner@example.local", password: "Cleaner-1001", role: "CLEANER" },
  { name: "Irfan", email: "irfan.cleaner@example.local", password: "Cleaner-1002", role: "CLEANER" },
  { name: "Lawrence", email: "lawrence.cleaner@example.local", password: "Cleaner-1003", role: "CLEANER" },
  { name: "Elina", email: "elina.cleaner@example.local", password: "Cleaner-1004", role: "CLEANER" },
  { name: "Emily", email: "emily.cleaner@example.local", password: "Cleaner-1005", role: "CLEANER" },
  { name: "Ops Manager", email: "manager@example.local", password: "Manager-2001", role: "MANAGER" },
  { name: "System Admin", email: "admin@example.local", password: "Admin-3001", role: "ADMIN" },
];

async function loadEnvFile() {
  const content = await readFile(envPath, "utf8");

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

function getRequiredEnv(key) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function extensionlessName(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

function toCloudinaryPublicId(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function getPropertyDirectories() {
  const entries = await readdir(baseImagesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function getImageFiles(propertyName) {
  const propertyDir = path.join(baseImagesDir, propertyName);
  const entries = await readdir(propertyDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function seedProperties() {
  const propertyNames = await getPropertyDirectories();
  const seededProperties = [];

  for (const propertyName of propertyNames) {
    const imageFiles = await getImageFiles(propertyName);
    const tasks = [];

    for (const imageFile of imageFiles) {
      const taskName = extensionlessName(imageFile);
      const imagePath = path.join(baseImagesDir, propertyName, imageFile);
      const publicId = [
        "cleaner-qc",
        "reference",
        toCloudinaryPublicId(propertyName),
        toCloudinaryPublicId(taskName),
      ].join("/");

      const uploadResult = await cloudinary.uploader.upload(imagePath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      tasks.push({
        taskName,
        referenceImageUrl: uploadResult.secure_url,
      });
    }

    const coverImage = tasks[0]?.referenceImageUrl ?? "";
    const property = await Property.findOneAndUpdate(
      { name: propertyName },
      {
        $set: {
          name: propertyName,
          coverImage,
          tasks,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      },
    ).lean();

    seededProperties.push({
      id: property._id.toString(),
      name: property.name,
      taskCount: property.tasks.length,
    });

    console.log(`Seeded ${property.name}: ${property.tasks.length} tasks`);
  }

  return seededProperties;
}

async function seedUsers() {
  const seededUsers = [];

  for (const user of sampleUsers) {
    await User.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          name: user.name,
          email: user.email,
          role: user.role,
          active: true,
          password: hashPassword(user.password),
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      },
    );

    seededUsers.push(user);
  }

  return seededUsers;
}

async function main() {
  await loadEnvFile();

  cloudinary.config({
    cloud_name: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: getRequiredEnv("CLOUDINARY_API_KEY"),
    api_secret: getRequiredEnv("CLOUDINARY_API_SECRET"),
    secure: true,
  });

  await mongoose.connect(getRequiredEnv("MONGODB_URI"), {
    bufferCommands: false,
  });

  const properties = await seedProperties();
  const users = await seedUsers();

  console.log("\nSeed complete");
  console.log(`Properties: ${properties.length}`);
  console.log(`Tasks: ${properties.reduce((total, property) => total + property.taskCount, 0)}`);
  console.log("\nSample users");

  for (const user of users) {
    console.log(`${user.role}: ${user.email} / ${user.password}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

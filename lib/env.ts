export const requiredServerEnvKeys = [
  "MONGODB_URI",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "OLLAMA_KEY",
] as const;

type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number];
type OptionalServerEnvKey =
  | "OPENAI_API_KEY"
  | "AI_BASE_URL"
  | "AI_MODEL"
  | "AI_MODEL_BASE"
  | "AI_MODEL_APPEAL";

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^['"]|['"]$/g, "");
}

export function getRequiredEnv(key: RequiredServerEnvKey) {
  const value = normalizeEnvValue(process.env[key]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getOptionalEnv(key: OptionalServerEnvKey) {
  return normalizeEnvValue(process.env[key]);
}

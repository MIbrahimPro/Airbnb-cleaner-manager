export const requiredServerEnvKeys = [
  "MONGODB_URI",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number] | "OPENAI_API_KEY" | "OLLAMA_KEY";
type OptionalServerEnvKey =
  | "AI_PROVIDER"
  | "AI_BASE_URL"
  | "AI_MODEL"
  | "AI_MODEL_BASE"
  | "AI_MODEL_APPEAL"
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL_BASE"
  | "OPENAI_MODEL_APPEAL"
  | "OLLAMA_KEY"
  | "OLLAMA_MODEL_BASE"
  | "OLLAMA_MODEL_APPEAL";

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

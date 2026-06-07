import OpenAI from "openai";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

export function getAiConfig() {
  return {
    provider: "ollama",
    baseURL: getOptionalEnv("AI_BASE_URL") ?? "https://ollama.com/v1",
    baseModel: getOptionalEnv("AI_MODEL_BASE") ?? getOptionalEnv("AI_MODEL") ?? "gemma3:4b",
    appealModel: getOptionalEnv("AI_MODEL_APPEAL") ?? "llama3.2-vision",
  };
}

export function getAiClient() {
  const config = getAiConfig();
  const ollamaKey = getRequiredEnv("OLLAMA_KEY");

  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: ollamaKey,
  });
}

export function getAiAuthErrorMessage(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;

  if (status === 401) {
    return `AI provider unauthorized. Check OLLAMA_KEY in Netlify environment variables, remove surrounding quotes/spaces, and redeploy.`;
  }

  return null;
}

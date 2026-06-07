import OpenAI from "openai";
import { getOptionalEnv } from "@/lib/env";

export function getAiConfig() {
  const openAiKey = getOptionalEnv("OPENAI_API_KEY");

  return {
    provider: openAiKey ? "openai" : "ollama",
    baseURL: getOptionalEnv("AI_BASE_URL") ?? "https://api.ollama.com/v1",
    baseModel: getOptionalEnv("AI_MODEL_BASE") ?? getOptionalEnv("AI_MODEL") ?? "gemma3:4b",
    appealModel: getOptionalEnv("AI_MODEL_APPEAL") ?? "llama3.2-vision",
  };
}

export function getAiClient() {
  const config = getAiConfig();
  const openAiKey = getOptionalEnv("OPENAI_API_KEY");
  const ollamaKey = process.env.OLLAMA_KEY;
  const apiKey = config.provider === "openai" ? openAiKey : ollamaKey;

  if (!apiKey) {
    throw new Error(
      config.provider === "openai"
        ? "Missing required environment variable: OPENAI_API_KEY"
        : "Missing required environment variable: OLLAMA_KEY",
    );
  }

  return new OpenAI({
    baseURL: config.provider === "openai" ? undefined : config.baseURL,
    apiKey,
  });
}

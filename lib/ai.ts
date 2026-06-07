import OpenAI from "openai";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

export const aiConfig = {
  provider: getOptionalEnv("OPENAI_API_KEY") ? "openai" : "ollama",
  baseURL: getOptionalEnv("AI_BASE_URL") ?? "https://api.ollama.com/v1",
  baseModel: getOptionalEnv("AI_MODEL_BASE") ?? getOptionalEnv("AI_MODEL") ?? "gemma3:4b",
  appealModel: getOptionalEnv("AI_MODEL_APPEAL") ?? "llama3.2-vision",
};

const aiClient = new OpenAI({
  baseURL: aiConfig.provider === "openai" ? undefined : aiConfig.baseURL,
  apiKey: aiConfig.provider === "openai" ? getOptionalEnv("OPENAI_API_KEY") : getRequiredEnv("OLLAMA_KEY"),
});

export default aiClient;

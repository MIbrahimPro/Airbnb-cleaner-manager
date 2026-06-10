import OpenAI from "openai";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

const aiImageTransform = "f_jpg,q_auto:eco,w_1280,c_limit";
const aiImageFetchTimeoutMs = 8_000;
const maxAiImageBytes = 2.5 * 1024 * 1024;
const imageDataUrlCache = new Map<string, { dataUrl: string; expiresAt: number }>();

export type AiProvider = "openai" | "ollama";

export type AiImageContentPart =
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail: "high";
      };
    }
  | {
      type: "image_url";
      image_url: string;
    };

function getAiProvider(): AiProvider {
  const configuredProvider = getOptionalEnv("AI_PROVIDER")?.toLowerCase();

  if (configuredProvider === "openai" || configuredProvider === "ollama") {
    return configuredProvider;
  }

  return getOptionalEnv("OPENAI_API_KEY") ? "openai" : "ollama";
}

export function getAiConfig() {
  const provider = getAiProvider();

  if (provider === "openai") {
    return {
      provider,
      baseModel: getOptionalEnv("OPENAI_MODEL_BASE") ?? getOptionalEnv("AI_MODEL_BASE") ?? "gpt-5.4-mini",
      appealModel: getOptionalEnv("OPENAI_MODEL_APPEAL") ?? getOptionalEnv("AI_MODEL_APPEAL") ?? "gpt-5.4",
    };
  }

  return {
    provider,
    baseURL: getOptionalEnv("AI_BASE_URL") ?? "https://ollama.com/v1",
    baseModel:
      getOptionalEnv("OLLAMA_MODEL_BASE") ?? getOptionalEnv("AI_MODEL_BASE") ?? getOptionalEnv("AI_MODEL") ?? "gemma3:4b",
    appealModel: getOptionalEnv("OLLAMA_MODEL_APPEAL") ?? getOptionalEnv("AI_MODEL_APPEAL") ?? "llama3.2-vision",
  };
}

export function getAiClient() {
  const config = getAiConfig();

  if (config.provider === "openai") {
    return new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
    });
  }

  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: getRequiredEnv("OLLAMA_KEY"),
  });
}

export function getAiOptimizedImageUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const uploadMarker = "/image/upload/";

    if (!url.hostname.endsWith("cloudinary.com") || !url.pathname.includes(uploadMarker)) {
      return imageUrl;
    }

    const [prefix, suffix] = url.pathname.split(uploadMarker);
    url.pathname = `${prefix}${uploadMarker}${aiImageTransform}/${suffix}`;
    return url.toString();
  } catch {
    return imageUrl;
  }
}

function pruneImageCache() {
  const now = Date.now();

  for (const [key, value] of imageDataUrlCache) {
    if (value.expiresAt <= now || imageDataUrlCache.size > 50) {
      imageDataUrlCache.delete(key);
    }
  }
}

export async function fetchImageAsDataUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  const optimizedUrl = getAiOptimizedImageUrl(imageUrl);
  const cached = imageDataUrlCache.get(optimizedUrl);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.dataUrl;
  }

  const response = await fetch(optimizedUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(aiImageFetchTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch image for AI review. Status: ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error("AI review image URL did not return an image.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > maxAiImageBytes) {
    throw new Error("AI review image is too large after optimization.");
  }

  const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
  pruneImageCache();
  imageDataUrlCache.set(optimizedUrl, {
    dataUrl,
    expiresAt: Date.now() + 10 * 60_000,
  });

  return dataUrl;
}

export async function getAiImageInput(imageUrl: string, provider: AiProvider) {
  const optimizedUrl = getAiOptimizedImageUrl(imageUrl);

  if (provider === "openai") {
    return optimizedUrl;
  }

  return fetchImageAsDataUrl(optimizedUrl);
}

export function createAiImageContentPart(provider: AiProvider, imageInput: string): AiImageContentPart {
  if (provider === "openai") {
    return {
      type: "image_url",
      image_url: {
        url: imageInput,
        detail: "high",
      },
    };
  }

  return {
    type: "image_url",
    image_url: imageInput,
  };
}

export function getAiAuthErrorMessage(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;

  if (status === 401) {
    const config = getAiConfig();
    const keyName = config.provider === "openai" ? "OPENAI_API_KEY" : "OLLAMA_KEY";

    return `AI provider unauthorized. Check ${keyName} in Netlify environment variables, remove surrounding quotes/spaces, and redeploy.`;
  }

  return null;
}

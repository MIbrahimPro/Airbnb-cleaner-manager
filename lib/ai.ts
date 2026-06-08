import OpenAI from "openai";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

const aiImageTransform = "f_jpg,q_auto:eco,w_1280,c_limit";
const aiImageFetchTimeoutMs = 8_000;
const maxAiImageBytes = 2.5 * 1024 * 1024;
const imageDataUrlCache = new Map<string, { dataUrl: string; expiresAt: number }>();

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

function getAiOptimizedImageUrl(imageUrl: string) {
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

export function getAiAuthErrorMessage(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;

  if (status === 401) {
    return `AI provider unauthorized. Check OLLAMA_KEY in Netlify environment variables, remove surrounding quotes/spaces, and redeploy.`;
  }

  return null;
}

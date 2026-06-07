import { v2 as cloudinary } from "cloudinary";
import { getRequiredEnv } from "@/lib/env";

let configured = false;

export function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
      api_key: getRequiredEnv("CLOUDINARY_API_KEY"),
      api_secret: getRequiredEnv("CLOUDINARY_API_SECRET"),
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

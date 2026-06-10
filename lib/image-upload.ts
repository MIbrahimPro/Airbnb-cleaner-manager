const maxImageUploadBytes = 5 * 1024 * 1024;

export function validateImageUpload(file: File, label = "Image") {
  if (!file.type.startsWith("image/")) {
    return `${label} must be an image file.`;
  }

  if (file.size > maxImageUploadBytes) {
    return `${label} is too large. Please upload an image under 5 MB.`;
  }

  return null;
}

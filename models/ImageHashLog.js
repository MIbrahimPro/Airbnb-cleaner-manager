import mongoose from "mongoose";

const imageHashLogSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    cleanerName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.ImageHashLog || mongoose.model("ImageHashLog", imageHashLogSchema);


import mongoose from "mongoose";

const propertyTaskSchema = new mongoose.Schema(
  {
    taskName: {
      type: String,
      required: true,
      trim: true,
    },
    referenceImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    tasks: {
      type: [propertyTaskSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.models.Property || mongoose.model("Property", propertySchema);


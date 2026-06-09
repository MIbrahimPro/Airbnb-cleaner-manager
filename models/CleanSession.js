import mongoose from "mongoose";

const taskStatusValues = ["PENDING", "PASS", "FAIL"];

const completedTaskSchema = new mongoose.Schema(
  {
    taskName: {
      type: String,
      required: true,
      trim: true,
    },
    liveImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    referenceImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: taskStatusValues,
      default: "PENDING",
    },
    aiFeedback: {
      type: String,
      default: "",
      trim: true,
    },
    cleanType: {
      type: String,
      default: "",
      trim: true,
    },
    cleanerNotes: {
      type: String,
      default: "",
      trim: true,
    },
    appealed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const cleanSessionSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    cleanerName: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    totalScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    tasksCompleted: {
      type: [completedTaskSchema],
      default: [],
    },
    finalized: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.models.CleanSession || mongoose.model("CleanSession", cleanSessionSchema);

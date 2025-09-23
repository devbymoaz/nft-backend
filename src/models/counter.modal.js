import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);

export const Counter = mongoose.model("Counter", counterSchema);

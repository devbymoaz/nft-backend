import mongoose, { Schema } from "mongoose";

const uidSchema = new Schema(
  {
    seqId: { type: Number, unique: true, index: true },
    uniqueId: { type: String, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);

export const UID = mongoose.model("UID", uidSchema);

import mongoose, { Schema } from "mongoose";

const paymentProviderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentProviderSchema.statics.initializeDefaultProviders = async function () {
  try {
    const defaultProviders = [
      { name: "wert", isActive: false },
      { name: "nftpay", isActive: false },
      { name: "moonpay", isActive: false },
      { name: "crossmint", isActive: false },
      { name: "alchemypay", isActive: false },
      { name: "dropchain", isActive: false },
      { name: "withpaper", isActive: false },
      { name: "securecheckout", isActive: false },
      { name: "transak", isActive: false },
      { name: "thirdweb", isActive: false },
    ];

    for (const provider of defaultProviders) {
      const existingProvider = await this.findOne({ name: provider.name });
      if (!existingProvider) {
        await this.create(provider);
        console.log(`✅ Created payment provider: ${provider.name}`);
      }
    }
  } catch (error) {
    console.error("❌ Error initializing payment providers:", error);
  }
};

export const PaymentProvider = mongoose.model(
  "PaymentProvider",
  paymentProviderSchema
);

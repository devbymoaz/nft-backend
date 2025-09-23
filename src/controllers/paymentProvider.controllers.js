import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PaymentProvider } from "../models/paymentProvider.modal.js";

const getAllPaymentProviders = asyncHandler(async (req, res) => {
  await PaymentProvider.initializeDefaultProviders();

  const providers = await PaymentProvider.find().select("_id name");

  return res.status(200).json(
    new ApiResponse(200, providers, "Payment providers retrieved successfully")
  );
});

export { getAllPaymentProviders };

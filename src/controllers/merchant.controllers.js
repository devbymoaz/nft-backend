import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Merchant } from "../models/merchant.modal.js";
import { PaymentProvider } from "../models/paymentProvider.modal.js";
import { Counter } from "../models/counter.modal.js";
import { UID } from "../models/uid.modal.js";

/* ---------- helpers ---------- */
const formatTs = (d) => `${new Date(d).toISOString().slice(0, 19)}.000000Z`;

const gen8 = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

/** Safely pull the authenticated user's id (supports common shapes) */
const getAuthUserId = (req) =>
  req?.merchant?._id || req?.user?.id || req?.auth?.userId || null;

const formatMerchant = (m, originalPassword = null) => ({
  id: m._id,
  unique_id: m.uniqueId, // optional in your schema; left here if you later add it
  name: m.name,
  email: m.email,
  email_verified_at: null,
  phone_number: m.phone,
  merchant_fee: m.merchantFee?.toString?.() ?? String(m.merchantFee ?? ""),
  admin_fee: m.adminFee,
  ...(originalPassword ? { original_password: originalPassword } : {}),
  role: "merchant",
  wallet: m.wallet,
  status: m.status === 1,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
  payment_providers: (m.paymentProviders || []).map((p) => ({
    id: p?._id,
    user_id: m._id,
    payment_provider_id: p?._id,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    provider: {
      id: p?._id,
      name: p?.name,
      created_at: p?.createdAt,
      updated_at: p?.updatedAt,
    },
  })),
});

const formatMerchantFullProviders = (m) => ({
  id: m._id,
  unique_id: m.uniqueId, // optional
  name: m.name,
  email: m.email,
  email_verified_at: null,
  phone_number: m.phone,
  merchant_fee: m.merchantFee?.toString?.() ?? String(m.merchantFee ?? ""),
  admin_fee: m.adminFee,
  role: "merchant",
  wallet: m.wallet,
  status: m.status === 1,
  created_at: m.createdAt,
  updated_at: m.updatedAt,
  payment_providers: (m.paymentProviders || []).map((p) => ({
    id: p?._id,
    user_id: m._id,
    payment_provider_id: p?._id,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    provider: p, // full provider doc
  })),
});

/** Detect if the string is a Mongo ObjectId */
const isObjectId = (s) => /^[a-fA-F0-9]{24}$/.test(String(s));

/** Detect if the string is our 8-char UID */
const isUID8 = (s) => /^[A-Z0-9]{8}$/.test(String(s));

/**
 * Resolve merchant by either:
 *  - Mongo _id (24-hex)
 *  - 8-char UID (look up in UID collection, then merchant by createdBy)
 */
const resolveMerchantFromParam = async (idOrUid) => {
  if (isObjectId(idOrUid)) {
    const m = await Merchant.findById(idOrUid)
      .select("-password")
      .populate({ path: "paymentProviders" });
    return m;
  }

  if (isUID8(idOrUid)) {
    const uidDoc = await UID.findOne({ uniqueId: idOrUid });
    if (!uidDoc) return null;
    const m = await Merchant.findById(uidDoc.createdBy)
      .select("-password")
      .populate({ path: "paymentProviders" });
    return m;
  }

  return null;
};

/* ------- existing handlers (with robustness tweaks) ------- */
const registerMerchant = asyncHandler(async (req, res) => {
  const { name, email, phone, password, wallet, adminFee } = req.body;
  if (!name || !email || !password || !wallet || adminFee == null) {
    throw new ApiError(400, "All required fields must be provided");
  }

  const existedMerchant = await Merchant.findOne({ $or: [{ email: email.toLowerCase() }] });
  if (existedMerchant) throw new ApiError(409, "Merchant with this email already exists");

  const merchant = await Merchant.create({
    name: name.toLowerCase(),
    email: email.toLowerCase(),
    phone,
    password,
    wallet: wallet.toLowerCase(),
    adminFee,
    status: 0,
    merchantFee: 0,
  });

  const createdMerchant = await Merchant.findById(merchant._id).select("-password");
  if (!createdMerchant) throw new ApiError(500, "Something went wrong while registering the merchant");

  return res
    .status(201)
    .json(new ApiResponse(200, createdMerchant, "Merchant registered successfully"));
});

const getAllMerchants = asyncHandler(async (req, res) => {
  const merchants = await Merchant.find()
    .select("-password")
    .populate({ path: "paymentProviders", select: "name createdAt updatedAt" })
    .sort({ createdAt: -1 });

  const formatted = merchants.map((m) => ({
    id: m._id,
    unique_id: m.uniqueId,
    name: m.name,
    email: m.email,
    email_verified_at: null,
    phone_number: m.phone,
    merchant_fee: m.merchantFee?.toString?.() ?? String(m.merchantFee ?? ""),
    admin_fee: m.adminFee,
    role: "merchant",
    wallet: m.wallet,
    status: m.status === 1,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    payment_providers: (m.paymentProviders || []).map((p) => ({
      id: p._id,
      user_id: m._id,
      payment_provider_id: p._id,
      created_at: m.createdAt,
      updated_at: m.updatedAt,
      provider: {
        id: p._id,
        name: p.name,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      },
    })),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, formatted, "Merchants retrieved successfully"));
});

/**
 * Admin endpoint can now accept either:
 *  - /merchants/:id  where :id is a Mongo _id
 *  - /merchants/:id  where :id is an 8-char UID
 */
const getMerchantById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const merchant = await resolveMerchantFromParam(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");
  return res
    .status(200)
    .json(new ApiResponse(200, formatMerchantFullProviders(merchant), "Merchant retrieved successfully"));
});

const updateMerchant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // force resolution by Mongo _id only here (updates should target a specific doc id)
  if (!isObjectId(id)) throw new ApiError(400, "Invalid merchant id");

  const { name, email, password, phone_number, wallet, merchant_fee, admin_fee } = req.body;

  // normalize payment_providers from various incoming shapes
  let paymentProviders = [];
  if (Array.isArray(req.body.payment_providers)) {
    paymentProviders = req.body.payment_providers;
  } else {
    for (const key in req.body) {
      if (key.startsWith("payment_providers")) {
        if (Array.isArray(req.body[key])) paymentProviders.push(...req.body[key]);
        else paymentProviders.push(req.body[key]);
      }
    }
    if (paymentProviders.length === 0 && req.body.payment_providers)
      paymentProviders = [req.body.payment_providers];
    if (
      paymentProviders.length === 1 &&
      typeof paymentProviders[0] === "string" &&
      paymentProviders[0].includes(",")
    ) {
      paymentProviders = paymentProviders[0].split(",").map((s) => s.trim());
    }
  }

  const merchant = await Merchant.findById(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const updateData = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email.toLowerCase();
  if (password) updateData.password = password;
  if (phone_number) updateData.phone = phone_number;
  if (wallet) updateData.wallet = wallet;

  // keep admin_fee + merchant_fee sum to 100 if one changes and the other is absent
  if (admin_fee !== undefined) {
    const af = parseFloat(admin_fee);
    if (Number.isNaN(af)) throw new ApiError(400, "admin_fee must be a number");
    updateData.adminFee = af;
    if (merchant_fee === undefined) updateData.merchantFee = 100 - af;
  }
  if (merchant_fee !== undefined) {
    const mf = parseFloat(merchant_fee);
    if (Number.isNaN(mf)) throw new ApiError(400, "merchant_fee must be a number");
    updateData.merchantFee = mf;
    if (admin_fee === undefined) updateData.adminFee = 100 - mf;
  }

  if (paymentProviders.length > 0) {
    const valid = [];
    const uniq = [...new Set(paymentProviders)];
    for (const providerId of uniq) {
      if (!providerId) continue;
      const provider = await PaymentProvider.findById(providerId);
      if (!provider) throw new ApiError(400, `Payment provider with ID ${providerId} not found`);
      valid.push(providerId);
    }
    updateData.paymentProviders = valid;
  }

  const updated = await Merchant.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .select("-password")
    .populate({ path: "paymentProviders", select: "name createdAt updatedAt" });

  if (!updated) throw new ApiError(404, "Merchant not found");

  return res.status(200).json(
    new ApiResponse(
      200,
      formatMerchant(updated, password ? password : "Hidden for security"),
      "Merchant updated successfully"
    )
  );
});

const deleteMerchant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) throw new ApiError(400, "Invalid merchant id");
  const deleted = await Merchant.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, "Merchant not found");
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Merchant deleted successfully"));
});

/* ------- protected: create/list UIDs (requires token) ------- */
const generateEphemeralUID = asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) throw new ApiError(401, "Unauthorized");

  // ensure unique code across UID (and optionally Merchant.uniqueId if you add it)
  let code = gen8();
  /* eslint-disable no-await-in-loop */
  // The second condition is harmless if Merchant doesn't have uniqueId in schema.
  while (await UID.exists({ uniqueId: code }) || (await Merchant.exists({ uniqueId: code }))) {
    code = gen8();
  }

  const seqDoc = await Counter.findByIdAndUpdate(
    "uid_seq",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const record = await UID.create({
    seqId: seqDoc.seq,
    uniqueId: code,
    createdBy: userId, // associate to the requesting merchant
  });

  const payload = {
    id: record.seqId,
    unique_id: record.uniqueId,
    created_at: formatTs(record.createdAt),
    updated_at: formatTs(record.updatedAt),
  };

  return res
    .status(201)
    .json(new ApiResponse(201, payload, "UID generated successfully"));
});

const getAllGeneratedUIDs = asyncHandler(async (req, res) => {
  const userId = getAuthUserId(req);
  if (!userId) throw new ApiError(401, "Unauthorized");

  const list = await UID.find({ createdBy: userId }).sort({ createdAt: -1 });

  const data = list.map((r) => ({
    id: r.seqId,
    unique_id: r.uniqueId,
    created_at: formatTs(r.createdAt),
    updated_at: formatTs(r.updatedAt),
  }));

  return res.status(200).json(new ApiResponse(200, data, "UIDs retrieved successfully"));
});

/* ------- public: fetch merchant by UID (no token) ------- */
const publicMerchantByUniqueId = asyncHandler(async (req, res, next) => {
  const { uniqueId } = req.params;

  // Not our UID format? Pass to next route (e.g., could be a slugs router)
  if (!isUID8(uniqueId)) return next();

  // 1) Find the UID doc
  const uidDoc = await UID.findOne({ uniqueId });
  if (!uidDoc) throw new ApiError(404, "Merchant not found");

  // 2) Resolve merchant that created the UID
  const m = await Merchant.findById(uidDoc.createdBy)
    .select("-password")
    .populate({ path: "paymentProviders" });

  if (!m) throw new ApiError(404, "Merchant not found");

  // 3) Return merchant with full provider details
  return res
    .status(200)
    .json(new ApiResponse(200, formatMerchantFullProviders(m), "Merchant retrieved"));
});

export {
  registerMerchant,
  getAllMerchants,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  generateEphemeralUID,
  getAllGeneratedUIDs,
  publicMerchantByUniqueId,
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.modal.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { Merchant } from "../models/merchant.modal.js";
import { Admin } from "../models/admin.modal.js";

const STATIC_ADMIN_EMAIL = "admin@example.com";
const STATIC_ADMIN_PASSWORD = "password";

// ---- token helpers ----
const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();   // ensure it uses ACCESS_TOKEN_SECRET
    const refreshToken = user.generateRefreshToken(); // ensure it uses REFRESH_TOKEN_SECRET
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (e) {
    throw new ApiError(500, "Something went wrong while generating refresh/access token");
  }
};

const generateMerchantTokens = async (merchantId) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    const accessToken = jwt.sign(
      { _id: merchant._id, email: merchant.email, name: merchant.name, role: "merchant", tokenType: "access" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { _id: merchant._id, tokenType: "refresh" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    merchant.refreshToken = refreshToken;
    await merchant.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (e) {
    throw new ApiError(500, "Something went wrong while generating refresh/access token: " + e.message);
  }
};

const generateAdminTokens = async (adminId) => {
  try {
    const admin = await Admin.findById(adminId);
    const accessToken = jwt.sign(
      { _id: admin._id, email: admin.email, name: admin.name, role: admin.role || "admin", tokenType: "access" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { _id: admin._id, tokenType: "refresh" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (e) {
    throw new ApiError(500, "Something went wrong while generating refresh/access token: " + e.message);
  }
};

// ---- controllers ----
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "unauthorized request");

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (e) {
    throw new ApiError(401, e?.message || "Invalid refresh token");
  }

  // user
  let user = await User.findById(decoded?._id);
  if (user) {
    if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Refresh token is expired or used");
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed"));
  }

  // merchant
  let merchant = await Merchant.findById(decoded?._id);
  if (merchant) {
    if (incomingRefreshToken !== merchant?.refreshToken) throw new ApiError(401, "Refresh token is expired or used");
    const { accessToken, refreshToken } = await generateMerchantTokens(merchant._id);
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed"));
  }

  // admin
  let admin = await Admin.findById(decoded?._id);
  if (admin) {
    if (incomingRefreshToken !== admin?.refreshToken) throw new ApiError(401, "Refresh token is expired or used");
    const { accessToken, refreshToken } = await generateAdminTokens(admin._id);
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { accessToken, refreshToken }, "Access token refreshed"));
  }

  throw new ApiError(401, "Invalid refresh token");
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!email && !username) throw new ApiError(400, "username or email is required");

  // static admin
  if (email === STATIC_ADMIN_EMAIL) {
    if (password !== STATIC_ADMIN_PASSWORD) throw new ApiError(401, "Invalid admin credentials");
    let admin = await Admin.findOne({ email: STATIC_ADMIN_EMAIL });
    if (!admin) admin = await Admin.create({ email: STATIC_ADMIN_EMAIL, name: "System Administrator", role: "superadmin" });
    const { accessToken, refreshToken } = await generateAdminTokens(admin._id);
    const loggedInAdmin = await Admin.findById(admin._id).select("-password -refreshToken");
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { admin: loggedInAdmin, accessToken, refreshToken, userType: "admin" }, "Admin logged In Successfully"));
  }

  // user
  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (user) {
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) throw new ApiError(401, "Invalid user credentials");
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken, userType: "user" }, "User logged In Successfully"));
  }

  // merchant
  const merchant = await Merchant.findOne({ email: email?.toLowerCase() });
  if (merchant) {
    if (merchant.password !== password) throw new ApiError(401, "Invalid merchant credentials");
    const { accessToken, refreshToken } = await generateMerchantTokens(merchant._id);
    const loggedInMerchant = await Merchant.findById(merchant._id).select("-password -refreshToken");
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { merchant: loggedInMerchant, accessToken, refreshToken, userType: "merchant" }, "Merchant logged In Successfully"));
  }

  // db admins
  const admin = await Admin.findOne({ email: email?.toLowerCase() });
  if (admin) {
    if (admin.password !== password) throw new ApiError(401, "Invalid admin credentials");
    const { accessToken, refreshToken } = await generateAdminTokens(admin._id);
    const loggedInAdmin = await Admin.findById(admin._id).select("-password -refreshToken");
    const options = { httpOnly: true, secure: true };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { admin: loggedInAdmin, accessToken, refreshToken, userType: "admin" }, "Admin logged In Successfully"));
  }

  throw new ApiError(404, "User does not exist");
});

const logoutUser = asyncHandler(async (req, res) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } }, { new: true });
  } else if (req.merchant) {
    await Merchant.findByIdAndUpdate(req.merchant._id, { $unset: { refreshToken: 1 } }, { new: true });
  } else if (req.admin) {
    await Admin.findByIdAndUpdate(req.admin._id, { $unset: { refreshToken: 1 } }, { new: true });
  }

  const options = { httpOnly: true, secure: true };
  return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User logged Out"));
});

export { loginUser, logoutUser, refreshAccessToken };

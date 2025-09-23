import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.modal.js";
import { Merchant } from "../models/merchant.modal.js";
import { Admin } from "../models/admin.modal.js";

export const verifyJWT = asyncHandler(async (req, _res, next) => {
  const hdr = req.header("Authorization") || "";
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : null;
  const token = req.cookies?.accessToken || bearer;
  if (!token) throw new ApiError(401, "Unauthorized request");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] });
  } catch (e) {
    if (e.name === "TokenExpiredError") throw new ApiError(401, "Access token expired");
    throw new ApiError(401, "Invalid access token");
  }

  const id = decoded._id || decoded.id;
  if (!id) throw new ApiError(401, "Invalid access token");

  // Prefer role hint if present
  let principal = null;
  if (decoded.role === "merchant") {
    principal = await Merchant.findById(id).select("-password -refreshToken");
    if (principal) { req.merchant = principal; req.authRole = "merchant"; return next(); }
  }
  if (decoded.role === "admin") {
    principal = await Admin.findById(id).select("-password -refreshToken");
    if (principal) { req.admin = principal; req.authRole = "admin"; return next(); }
  }
  if (decoded.role === "user") {
    principal = await User.findById(id).select("-password -refreshToken");
    if (principal) { req.user = principal; req.authRole = "user"; return next(); }
  }

  principal = await Merchant.findById(id).select("-password -refreshToken");
  if (principal) { req.merchant = principal; req.authRole = "merchant"; return next(); }
  principal = await Admin.findById(id).select("-password -refreshToken");
  if (principal) { req.admin = principal; req.authRole = "admin"; return next(); }
  principal = await User.findById(id).select("-password -refreshToken");
  if (principal) { req.user = principal; req.authRole = "user"; return next(); }

  throw new ApiError(401, "Invalid access token");
});

export const requireMerchant = (req, res, next) => {
  if (!req.merchant) return res.status(403).json({ message: "Forbidden" });
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};


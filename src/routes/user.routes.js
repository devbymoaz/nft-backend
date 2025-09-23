import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controllers.js";
import { verifyJWT, requireMerchant, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  deleteMerchant,
  generateEphemeralUID,
  getAllGeneratedUIDs,
  getAllMerchants,
  getMerchantById,
  registerMerchant,
  updateMerchant,
  publicMerchantByUniqueId,
} from "../controllers/merchant.controllers.js";
import { getAllPaymentProviders } from "../controllers/paymentProvider.controllers.js";

const router = Router();

/* --------- auth --------- */
router.post("/login", loginUser);
router.post("/logout", verifyJWT, logoutUser);
router.post("/refresh-token", refreshAccessToken);

/* --------- admin (merchants/providers) --------- */
router.post("/merchants/register", verifyJWT, requireAdmin, registerMerchant);
router.get("/merchants", verifyJWT, requireAdmin, getAllMerchants);

// NOTE: :id can now be either a Mongo _id OR an 8-char UID.
router
  .route("/merchants/:id")
  .get(verifyJWT, requireAdmin, getMerchantById)
  .put(verifyJWT, requireAdmin, updateMerchant)   // expects Mongo _id
  .delete(verifyJWT, requireAdmin, deleteMerchant); // expects Mongo _id

router.get("/providers", verifyJWT, requireAdmin, getAllPaymentProviders);

/* --------- merchant (uids) --------- */
router.post("/uid/generate", verifyJWT, requireMerchant, generateEphemeralUID);
router.get("/uids", verifyJWT, requireMerchant, getAllGeneratedUIDs);

router.get("/:uniqueId", publicMerchantByUniqueId);

export default router;

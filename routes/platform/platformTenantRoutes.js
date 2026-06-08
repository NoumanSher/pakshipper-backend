import express from "express";
import {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  suspendTenant,
  activateTenant,
  deleteTenant,
  permanentDeleteTenant,
  getTenantStats,
  getPlatformOverview,
  updateTenantOwner
} from "../../controllers/platform/tenantController.js";
import platformAuth from "../../middlewares/platformAuth.js";

const router = express.Router();

// Protect all routes under this file with platformAuth
router.use(platformAuth);

router.get("/overview", getPlatformOverview);

router.route("/")
  .post(createTenant)
  .get(getAllTenants);

router.route("/:id")
  .get(getTenantById)
  .put(updateTenant)
  .delete(deleteTenant);

router.patch("/:id/suspend", suspendTenant);
router.patch("/:id/activate", activateTenant);
router.get("/:id/stats", getTenantStats);
router.delete("/:id/permanent", permanentDeleteTenant);
router.put("/:id/owner", updateTenantOwner);

export default router;

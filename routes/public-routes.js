import express from "express";
import { getPlatformConnection } from "../config/platformConnection.js";
import NodeCache from "node-cache";

const router = express.Router();
const lookupCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * @route   GET /api/public/resolve-tenant
 * @desc    Public, unauthenticated store identifier lookup. Returns minimal branding info (name, slug).
 * @access  Public
 */
router.get("/resolve-tenant", async (req, res) => {
  try {
    const slug = (req.query.slug || "").toString().trim().toLowerCase();
    if (!slug || slug.length < 2) {
      return res.status(400).json({ error: "A store identifier is required." });
    }

    const cached = lookupCache.get(slug);
    if (cached !== undefined) {
      return cached
        ? res.status(200).json(cached)
        : res.status(404).json({ error: "Store not found." });
    }

    const platformConn = getPlatformConnection();
    const TenantModel = platformConn.model("Tenant");
    const tenant = await TenantModel.findOne({ slug, status: "active" })
      .select("name slug")
      .lean();

    lookupCache.set(slug, tenant || null);

    if (!tenant) {
      return res.status(404).json({ error: "Store not found." });
    }

    res.status(200).json({ name: tenant.name, slug: tenant.slug });
  } catch (error) {
    console.error("Error resolving tenant:", error);
    res.status(500).json({ error: "Failed to resolve store." });
  }
});

export default router;

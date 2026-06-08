import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectToPlatformDB } from "../config/platformConnection.js";
import { getTenantConnection } from "../config/connectionPool.js";
import bcrypt from "bcrypt";

dotenv.config();

const seedTenant = async () => {
  console.log("🚀 Starting Tenant Seeding Script...");

  const tenantSlug = process.argv[2] || process.env.TENANT_SLUG || "sandbox-store";
  console.log(`🏢 Seeding Tenant: ${tenantSlug}`);

  let platformDb, tenantConn;

  try {
    // 1. Connect to Platform DB to get Tenant info
    platformDb = await connectToPlatformDB();
    const Tenant = platformDb.model("Tenant");

    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      console.error(`❌ Tenant with slug "${tenantSlug}" not found! Run "node scripts/setup-test-platform.js" first.`);
      await platformDb.close();
      process.exit(1);
    }

    // 2. Connect to Tenant DB
    const { decrypt } = await import("../utils/encryption.js");
    const decryptedConnectionString = decrypt(tenant.database.connectionString);
    tenantConn = await getTenantConnection(tenant._id.toString(), decryptedConnectionString);
    console.log(`🔌 Connected to Tenant DB: ${tenant.database.name}`);

    const Product = tenantConn.model("Product");
    const ParentCategory = tenantConn.model("ParentCategories");
    const ChildCategory = tenantConn.model("ChildCategories");
    const User = tenantConn.model("User");
    const Role = tenantConn.model("Role");

    // 3. Find/Seed Store Manager User
    console.log("👥 Checking/Seeding Manager User...");
    const managerRole = await Role.findOne({ name: "manager" });
    if (!managerRole) {
      throw new Error("Manager role not found in tenant database. Ensure roles are seeded first.");
    }

    const managerEmail = `manager@${tenantSlug}.com`;
    let managerUser = await User.findOne({ email: managerEmail });
    if (!managerUser) {
      const hashedPassword = await bcrypt.hash("managerpassword123", 10);
      managerUser = new User({
        email: managerEmail,
        username: "Store Manager",
        password: hashedPassword,
        confirmPassword: hashedPassword,
        role: managerRole._id
      });
      await managerUser.save();
      console.log(`✅ Manager User created: ${managerEmail}`);
    } else {
      console.log(`   - Manager User already exists: ${managerEmail}`);
    }

    // 4. Seed Categories
    console.log("📁 Seeding Categories...");
    const categoryData = [
      { name: "Electronics", slug: "electronics", description: "Gadgets and tech hardware" },
      { name: "Fashion & Apparel", slug: "fashion-apparel", description: "Trendy clothes and shoes" },
      { name: "Home & Kitchen", slug: "home-kitchen", description: "Furniture and diningware" }
    ];

    const parentCategories = [];
    for (const cat of categoryData) {
      const created = await ParentCategory.findOneAndUpdate(
        { slug: cat.slug },
        cat,
        { upsert: true, new: true }
      );
      parentCategories.push(created);
    }
    console.log(`✅ Seeded ${parentCategories.length} parent categories.`);

    // Seed Child Categories
    const childCategoryData = [
      { name: "Smartphones", slug: "smartphones", parentCategory: parentCategories[0]._id },
      { name: "Laptops", slug: "laptops", parentCategory: parentCategories[0]._id },
      { name: "Men's Clothing", slug: "mens-clothing", parentCategory: parentCategories[1]._id },
      { name: "Women's Clothing", slug: "womens-clothing", parentCategory: parentCategories[1]._id }
    ];

    const childCategories = [];
    for (const ccat of childCategoryData) {
      const created = await ChildCategory.findOneAndUpdate(
        { slug: ccat.slug },
        ccat,
        { upsert: true, new: true }
      );
      childCategories.push(created);
    }
    console.log(`✅ Seeded ${childCategories.length} child categories.`);

    // 5. Seed Products
    console.log("📦 Seeding Products...");
    const productsData = [
      {
        productName: "iPhone 15 Pro Max",
        parentCategoryID: parentCategories[0]._id,
        childCategoryID: childCategories[0]._id,
        description: "Experience the ultimate iPhone with titanium casing and dynamic island.",
        salePrice: 1399,
        costPrice: 950,
        sku: "IPHONE-15-PM",
        stock: 50,
        discount: 5,
        isNew: true,
        images: [
          { src: "https://placehold.co/600x600?text=iPhone+15", alt: "iPhone 15 Pro Max", isThumbnail: true }
        ],
        seo: {
          metaTitle: "Buy iPhone 15 Pro Max Online | Best Price",
          metaDescription: "Get the best deal on iPhone 15 Pro Max with titanium finish.",
          metaKeywords: ["iphone", "apple", "smartphone", "iphone 15"],
          slug: "iphone-15-pro-max"
        },
        approvalStatus: "approved",
        approvalInfo: {
          approvedBy: managerUser._id,
          approvedAt: new Date(),
          comments: "Auto-approved seed product"
        }
      },
      {
        productName: "MacBook Pro 16 M3",
        parentCategoryID: parentCategories[0]._id,
        childCategoryID: childCategories[1]._id,
        description: "Powerhouse laptop for creative professionals with Apple M3 Max silicon.",
        salePrice: 2499,
        costPrice: 1800,
        sku: "MACBOOK-PRO-M3",
        stock: 25,
        discount: 0,
        images: [
          { src: "https://placehold.co/600x600?text=MacBook+M3", alt: "MacBook Pro M3", isThumbnail: true }
        ],
        seo: {
          metaTitle: "MacBook Pro 16-inch M3 Max | Shop Now",
          metaDescription: "Shop Apple MacBook Pro 16-inch with Apple Silicon M3 Max.",
          metaKeywords: ["macbook", "apple", "laptop", "m3 max"],
          slug: "macbook-pro-16-m3"
        },
        approvalStatus: "approved",
        approvalInfo: {
          approvedBy: managerUser._id,
          approvedAt: new Date(),
          comments: "Auto-approved seed product"
        }
      },
      {
        productName: "Classic Leather Jacket",
        parentCategoryID: parentCategories[1]._id,
        childCategoryID: childCategories[2]._id,
        description: "100% genuine premium cowhide leather jacket for standard fashion.",
        salePrice: 199,
        costPrice: 85,
        sku: "LEATHER-JACKET-1",
        stock: 120,
        discount: 10,
        images: [
          { src: "https://placehold.co/600x600?text=Leather+Jacket", alt: "Classic Leather Jacket", isThumbnail: true }
        ],
        seo: {
          metaTitle: "Genuine Classic Leather Jacket | Fashion Shop",
          metaDescription: "Classic men's genuine leather jacket at discounted prices.",
          metaKeywords: ["jacket", "leather", "mens fashion", "outerwear"],
          slug: "classic-leather-jacket"
        },
        approvalStatus: "approved",
        approvalInfo: {
          approvedBy: managerUser._id,
          approvedAt: new Date(),
          comments: "Auto-approved seed product"
        }
      }
    ];

    for (const prod of productsData) {
      await Product.findOneAndUpdate(
        { "seo.slug": prod.seo.slug },
        prod,
        { upsert: true }
      );
    }
    console.log(`✅ Seeded ${productsData.length} premium products.`);

    console.log("\n🎉 Tenant Database Seeding Completed Successfully!");
    
    // Close connections
    await platformDb.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed tenant:", error);
    if (platformDb) await platformDb.close().catch(() => {});
    process.exit(1);
  }
};

seedTenant();

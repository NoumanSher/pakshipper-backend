import bcrypt from "bcrypt";
import dotenv from "dotenv";
import ConnectDataBase from "./config/connection.js";
import Role from "./models/Role.js";
import User from "./models/user-schema.js";
import colors from "colors";

colors.enable();

dotenv.config();

const seedRoles = async () => {
    try {
        await ConnectDataBase();

        // 1. Create Admin Role
        let adminRole = await Role.findOne({ name: "admin" });
        if (!adminRole) {
            adminRole = await Role.create({
                name: "admin",
                permissions: ["all"], // admin bypasses permission checks
            });
            console.log("Admin role created");
        } else {
            adminRole.permissions = ["all"];
            await adminRole.save();
            console.log("Admin role permissions updated");
        }

        // 2. Create Manager Role
        let managerRole = await Role.findOne({ name: "manager" });
        if (!managerRole) {
            managerRole = await Role.create({
                name: "manager",
                permissions: [
                    "read:dashboard",
                    "manage:products",
                    "manage:orders",
                    "read:reviews",
                    "manage:reviews",
                ],
            });
            console.log("Manager role created");
        }

        // 3. Create User Role
        let userRole = await Role.findOne({ name: "user" });
        if (!userRole) {
            userRole = await Role.create({
                name: "user",
                permissions: ["read:products"],
            });
            console.log("User role created");
        }

        // 3. Update Existing Admin User (if any) or create one
        const adminEmail = process.env.ADMIN_EMAIL || "nouman@gmail.com";
        const adminPassword = process.env.ADMIN_PASSWORD || "123qwe";

        let adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            adminUser = await User.create({
                email: adminEmail,
                username: "admin",
                password: hashedPassword,
                role: adminRole._id,
            });
            console.log("Admin user created");
        } else {
            adminUser.role = adminRole._id;
            await adminUser.save();
            console.log("Admin user updated with role reference");
        }

        console.log("Seeding completed successfully");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding roles:", error);
        process.exit(1);
    }
};

seedRoles();

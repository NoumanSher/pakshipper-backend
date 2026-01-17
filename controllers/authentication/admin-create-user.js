import bcrypt from "bcrypt";
import User from "../../models/user-schema.js";
import Role from "../../models/Role.js";

/**
 * @route   POST /api/auth/admin/create-user
 * @desc    Admin can create a user with a specific role
 * @access  Private (Admin only)
 */
export const adminCreateUser = async (req, res) => {
    try {
        const { email, username, mobilePhone, password, roleName } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Find the role by name
        const role = await Role.findOne({ name: roleName || "user" });
        if (!role) {
            return res.status(404).json({ message: `Role '${roleName}' not found` });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            email,
            username,
            mobilePhone,
            password: hashedPassword,
            confirmPassword: hashedPassword, // satisfy validation if any
            role: role._id,
        });

        await newUser.save();

        // Populate role for response
        const populatedUser = await User.findById(newUser._id, "-password -refreshToken").populate("role");

        res.status(201).json({
            message: "User created successfully by admin",
            data: populatedUser,
        });
    } catch (error) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
};

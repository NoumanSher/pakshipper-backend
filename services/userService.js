import User from "../models/user-schema.js";
import Role from "../models/Role.js";
import AppError from "../utils/AppError.js";
import bcrypt from "bcrypt";

class UserService {
  /**
   * Get all users.
   */
  static async getAllUsers() {
    return await User.find().populate("role").sort({ createdAt: -1 });
  }

  /**
   * Admin: Create a new user with a specific role.
   */
  static async adminCreateUser(userData) {
    const { email, username, mobilePhone, password, roleName } = userData;

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("User already exists", 400);

    const role = await Role.findOne({ name: roleName || "user" });
    if (!role) throw new AppError(`Role '${roleName}' not found`, 404);

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      username,
      mobilePhone,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: role._id,
    });

    await newUser.save();
    return await User.findById(newUser._id, "-password -refreshToken").populate("role");
  }

  /**
   * Get user by ID.
   */
  static async getUserById(id) {
    const user = await User.findById(id).populate("role");
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  /**
   * Update user details.
   */
  static async updateUser(id, updateData) {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate("role");
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  /**
   * Delete a single user.
   */
  static async deleteUser(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  /**
   * Bulk delete users.
   */
  static async bulkDeleteUsers(ids) {
    const result = await User.deleteMany({ _id: { $in: ids } });
    return result.deletedCount;
  }
}

export default UserService;

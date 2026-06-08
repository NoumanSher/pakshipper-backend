import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";
import { z } from "zod";

const bulkDeleteUsersSchema = z.object({
  ids: z.array(z.string()).min(1),
});

/**
 * @route   DELETE /api/auth/delete-users
 * @desc    Delete multiple users by IDs
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const bulkDeleteUsers = asyncHandler(async (req, res) => {
    const { ids } = bulkDeleteUsersSchema.parse(req.body);
    const currentUserId = req.user?.id || req.user?._id;

    if (ids.includes(currentUserId?.toString())) {
        throw new AppError("You cannot delete your own account.", 400);
    }

    const users = await req.models.User.find({ _id: { $in: ids } }).populate("role");
    const hasOwner = users.some(u => u.role?.name === "owner");
    if (hasOwner) {
        throw new AppError("You cannot delete a store owner account.", 400);
    }

    const deletedCount = await UserService.bulkDeleteUsers(req.models, ids);

    res.status(200).json({
        message: "Users deleted successfully",
        deletedCount
    });
});

import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
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
    const deletedCount = await UserService.bulkDeleteUsers(ids);

    res.status(200).json({
        message: "Users deleted successfully",
        deletedCount
    });
});

import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

/**
 * @route   DELETE /api/auth/delete-user/:id
 * @desc    Delete a single user by ID
 * @access  Private (Admin only)
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} JSON response with success or error message
 */
export const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user?.id || req.user?._id;

    if (id === currentUserId?.toString()) {
        throw new AppError("You cannot delete your own account.", 400);
    }

    const targetUser = await req.models.User.findById(id).populate("role");
    if (!targetUser) {
        throw new AppError("User not found", 404);
    }

    const roleName = targetUser.role?.name;
    if (roleName === "owner") {
        throw new AppError("You cannot delete the store owner account.", 400);
    }

    await UserService.deleteUser(req.models, id);

    res.status(200).json({
        message: "User deleted successfully",
        deletedUserId: id
    });
});

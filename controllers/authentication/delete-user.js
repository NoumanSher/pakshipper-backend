import UserService from "../../services/userService.js";
import asyncHandler from "../../middlewares/asyncHandler.js";

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
    await UserService.deleteUser(id);

    res.status(200).json({
        message: "User deleted successfully",
        deletedUserId: id
    });
});

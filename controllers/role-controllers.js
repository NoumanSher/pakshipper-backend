/**
 * System role names that are fully protected from merchant panel operations.
 *   owner — Merchant system role. Full access. Read-only.
 *   user  — Storefront identity role. Never shown to merchant. Never modifiable.
 */
const SYSTEM_ROLE_NAMES = ['owner', 'user'];

/**
 * System role that is hidden from merchant panel list entirely.
 * The merchant panel RBAC system is for team management only.
 * Storefront users (role "user") are irrelevant to the merchant team view.
 */
const HIDDEN_FROM_MERCHANT = ['user'];

export const createRole = async (req, res) => {
    try {
        const { Role } = req.models;
        const { name, displayName, description, permissions, level } = req.body;

        if (!name || !displayName) {
            return res.status(400).json({
                success: false,
                error: "Role name (code) and displayName are required.",
            });
        }

        const normalizedName = name.trim().toLowerCase();

        // Guard reserved system role names — cannot be (re)created through normal API
        if (SYSTEM_ROLE_NAMES.includes(normalizedName)) {
            return res.status(400).json({
                success: false,
                error: `"${normalizedName}" is a reserved system role and cannot be created through this endpoint.`,
            });
        }

        // Prevent privilege escalation: custom roles must never reach the admin tier (>= 90)
        const parsedLevel = Number(level);
        const safeLevel = !isNaN(parsedLevel)
            ? Math.min(Math.max(parsedLevel, 0), 89)
            : 0;

        const role = await Role.create({
            name: normalizedName,
            displayName: displayName.trim(),
            description: description?.trim() || "",
            permissions: Array.isArray(permissions) ? permissions : [],
            level: safeLevel,
            isSystem: false,
        });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const getRoles = async (req, res) => {
    try {
        const { Role } = req.models;
        // Filter out storefront-only roles that have no meaning in the merchant panel
        const roles = await Role.find({ name: { $nin: HIDDEN_FROM_MERCHANT } })
            .sort({ level: -1, createdAt: 1 });
        res.status(200).json({ success: true, data: roles });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const updateRole = async (req, res) => {
    try {
        const { Role } = req.models;
        const { id } = req.params;
        const { name, displayName, description, permissions, level } = req.body;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }

        // Protect all system roles from any modifications
        if (SYSTEM_ROLE_NAMES.includes(role.name)) {
            const label = role.name === 'owner'
                ? "The Owner role defines full system access and cannot be modified."
                : `The "${role.name}" role is a system-managed role and cannot be modified.`;
            return res.status(400).json({ success: false, error: label });
        }

        const updatePayload = {};
        if (name !== undefined) {
            const normalizedName = name.trim().toLowerCase();
            // Prevent renaming to a reserved system name
            if (SYSTEM_ROLE_NAMES.includes(normalizedName)) {
                return res.status(400).json({
                    success: false,
                    error: `"${normalizedName}" is a reserved system role name.`,
                });
            }
            updatePayload.name = normalizedName;
        }
        if (displayName !== undefined) updatePayload.displayName = displayName.trim();
        if (description !== undefined) updatePayload.description = description.trim();
        if (permissions !== undefined) {
            updatePayload.permissions = Array.isArray(permissions) ? permissions : [];
        }

        // Prevent privilege escalation on level updates
        if (level !== undefined) {
            const parsedLevel = Number(level);
            if (!isNaN(parsedLevel)) {
                updatePayload.level = Math.min(Math.max(parsedLevel, 0), 89);
            }
        }

        // Enforce non-system status — custom roles cannot become system roles
        updatePayload.isSystem = false;

        const updatedRole = await Role.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        );
        res.status(200).json({ success: true, data: updatedRole });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { Role, User } = req.models;
        const { id } = req.params;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }

        // Protect all system roles from deletion
        if (SYSTEM_ROLE_NAMES.includes(role.name)) {
            const label = role.name === 'owner'
                ? "The Owner role defines full system access and cannot be deleted."
                : `The "${role.name}" role is a system-managed role and cannot be deleted.`;
            return res.status(400).json({ success: false, error: label });
        }

        // Check if any users are assigned to this role — return the list so UI can display them
        const assignedUsers = await User.find({ role: id })
            .select("username email")
            .limit(20)
            .lean();

        if (assignedUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete "${role.displayName || role.name}" because it is assigned to ${assignedUsers.length} user(s). Reassign them first.`,
                assignedUsers: assignedUsers.map(u => ({
                    id: u._id,
                    name: u.username || u.email,
                    email: u.email,
                })),
            });
        }

        await Role.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

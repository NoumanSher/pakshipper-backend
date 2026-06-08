export const createRole = async (req, res) => {
    try {
        const { Role } = req.models;
        const { name, permissions } = req.body;
        const role = await Role.create({ name, permissions });
        res.status(201).json({ success: true, data: role });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const getRoles = async (req, res) => {
    try {
        const { Role } = req.models;
        const roles = await Role.find();
        res.status(200).json({ success: true, data: roles });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const updateRole = async (req, res) => {
    try {
        const { Role } = req.models;
        const { id } = req.params;
        const { name, permissions } = req.body;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }

        // Protect owner and customer roles from modification
        if (role.name === 'owner' || role.name === 'customer') {
            return res.status(400).json({ 
                success: false, 
                error: "System-critical roles are protected and cannot be modified." 
            });
        }

        const updatedRole = await Role.findByIdAndUpdate(
            id,
            { name, permissions },
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

        // Prevent deleting owner and customer roles
        if (role.name === 'owner' || role.name === 'customer') {
            return res.status(400).json({ 
                success: false, 
                error: "System-critical roles are protected and cannot be deleted." 
            });
        }

        // Check if any users are assigned to this role
        const userAssigned = await User.findOne({ role: id });
        if (userAssigned) {
            return res.status(400).json({ 
                success: false, 
                error: "Cannot delete this role because it is currently assigned to one or more users." 
            });
        }

        await Role.findByIdAndDelete(id);
        res.status(200).json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};


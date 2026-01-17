import Role from "../models/Role.js";

export const createRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;
        const role = await Role.create({ name, permissions });
        res.status(201).json({ success: true, data: role });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json({ success: true, data: roles });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissions } = req.body;
        const role = await Role.findByIdAndUpdate(
            id,
            { name, permissions },
            { new: true, runValidators: true }
        );
        if (!role) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }
        res.status(200).json({ success: true, data: role });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const role = await Role.findByIdAndDelete(id);
        if (!role) {
            return res.status(404).json({ success: false, error: "Role not found" });
        }
        res.status(200).json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Role name is required"],
            unique: true,
            trim: true,
        },
        displayName: {
            type: String,
            required: [true, "Display name is required"],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        permissions: [
            {
                resource: {
                    type: String,
                    required: true,
                    enum: [
                        "dashboard",
                        "products",
                        "orders",
                        "categories",
                        "customers",
                        "settings",
                        "roles",
                        "reviews",
                        "notifications",
                        "store_config",
                        "analytics",
                    ],
                },
                actions: [
                    {
                        type: String,
                        enum: ["read", "write", "delete", "approve"],
                    },
                ],
            },
        ],
        isSystem: {
            type: Boolean,
            default: false,
        },
        level: {
            type: Number,
            default: 0,
            index: true,
        },
    },
    { timestamps: true }
);

export { roleSchema };
export default mongoose.model("Role", roleSchema);


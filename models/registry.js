import { userSchema } from "./user-schema.js";
import { roleSchema } from "./Role.js";
import { settingsSchema } from "./settings.js";
import { ProductSchema } from "./products.js";
import { postOrderSchema, counterSchema } from "./post-order.js";
import { ParentCategoriesSchema } from "./categories.js";
import { ChildCategoriesSchema } from "./child-categories.js";
import { UserCartSchema } from "./UserCart.js";
import { addressSchema } from "./address.js";
import { ReviewSchema } from "./Review.js";
import { notificationSchema } from "./notification.js";
import { faqSchema } from "./faq.js";
import { newsletterSchema } from "./newsletter.js";

/**
 * Compiles all tenant-specific models onto the provided Mongoose connection.
 * 
 * @param {import('mongoose').Connection} connection - The tenant's DB connection
 * @returns {void}
 */
export const compileTenantModels = (connection) => {
  if (!connection.models.Settings) connection.model("Settings", settingsSchema);
  if (!connection.models.User) connection.model("User", userSchema);
  if (!connection.models.Role) connection.model("Role", roleSchema);
  if (!connection.models.Product) connection.model("Product", ProductSchema);
  if (!connection.models.Counter) connection.model("Counter", counterSchema);
  if (!connection.models.PostOrder) connection.model("PostOrder", postOrderSchema);
  if (!connection.models.ParentCategories) connection.model("ParentCategories", ParentCategoriesSchema);
  if (!connection.models.ChildCategories) connection.model("ChildCategories", ChildCategoriesSchema);
  if (!connection.models.UserCart) connection.model("UserCart", UserCartSchema);
  if (!connection.models.Address) connection.model("Address", addressSchema);
  if (!connection.models.Review) connection.model("Review", ReviewSchema);
  if (!connection.models.Notification) connection.model("Notification", notificationSchema);
  if (!connection.models.Faq) connection.model("Faq", faqSchema);
  if (!connection.models.Newsletter) connection.model("Newsletter", newsletterSchema);
};

/**
 * Convenience function to extract all compiled models from a connection.
 * 
 * @param {import('mongoose').Connection} connection 
 * @returns {Object} Dictionary of compiled models
 */
export const getTenantModels = (connection) => {
  return {
    User: connection.models.User,
    Role: connection.models.Role,
    Settings: connection.models.Settings,
    Product: connection.models.Product,
    Counter: connection.models.Counter,
    PostOrder: connection.models.PostOrder,
    ParentCategories: connection.models.ParentCategories,
    ChildCategories: connection.models.ChildCategories,
    UserCart: connection.models.UserCart,
    Address: connection.models.Address,
    Review: connection.models.Review,
    Notification: connection.models.Notification,
    Faq: connection.models.Faq,
    Newsletter: connection.models.Newsletter,
  };
};

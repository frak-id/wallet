import { Elysia } from "elysia";
import { merchantBillingAdminRoutes } from "./billing";
import { merchantBillingAccountingRoutes } from "./billingAccounting";
import { merchantBillingDocumentRoutes } from "./billingDocuments";

/**
 * Single mount point for the merchant billing feature. The sub-groups keep
 * their own files (and their own per-route auth guards — `hasMerchantAccess`
 * for accounting/documents, `platformAdminAuthenticated` for admin CRUD), but
 * compose under one `/:merchantId/billing` prefix so the merchant router mounts
 * one billing group instead of three.
 */
export const merchantBillingRoutes = new Elysia({
    prefix: "/:merchantId/billing",
})
    .use(merchantBillingAccountingRoutes)
    .use(merchantBillingDocumentRoutes)
    .use(merchantBillingAdminRoutes);

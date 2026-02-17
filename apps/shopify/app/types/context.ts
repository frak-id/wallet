import type { authenticate } from "../shopify.server";

/**
 * Simple type for the authenticated admin context
 */
export type AuthenticatedContext = Awaited<
    ReturnType<typeof authenticate.admin>
>;

import { Elysia } from "elysia";
import { airtableRoutes } from "./airtable";
import { commonRoutes } from "./common";
import { mobileInstallContextRoutes } from "./mobileInstallContext";
import { socialRoute } from "./social";

/**
 * Shared API routes used both internally within the monorepo and externally
 * This includes endpoints for:
 * - Airtable integrations (used by landing pages)
 * - Social redirection (used to exit in-app browser)
 * - Common utilities (admin wallets, pricing, etc.)
 * - Mobile install context relay (ASWebAuthenticationSession cookie bridge)
 */
export const commonApi = new Elysia({ prefix: "/common" })
    .use(airtableRoutes)
    .use(socialRoute)
    .use(commonRoutes)
    .use(mobileInstallContextRoutes);

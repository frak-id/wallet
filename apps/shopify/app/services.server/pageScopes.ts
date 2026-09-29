import { AuthScopes } from "@shopify/shopify-api";
import type { AuthenticatedContext } from "../types/context";
import { PAGE_SCOPES } from "../utils/pageScopes";
import { log } from "./logger";

/** Whether the shop granted the optional page read and write scopes. */
export async function arePageScopesGranted(
    context: AuthenticatedContext
): Promise<boolean> {
    try {
        const { granted } = await context.scopes.query();
        return new AuthScopes(granted).has(PAGE_SCOPES);
    } catch (err) {
        log.error({ err }, "arePageScopesGranted failed");
        return false;
    }
}

import { AuthScopes } from "@shopify/shopify-api";
import type { AuthenticatedContext } from "../types/context";
import {
    MENU_SCOPES,
    PAGE_SCOPES,
    PROXY_SCOPES,
} from "../utils/optionalScopes";
import { log } from "./logger";

export type GrantedOptionalScopes = {
    proxy: boolean;
    menu: boolean;
    pages: boolean;
};

/** Which optional scope groups the shop granted; a write scope implies its read. `null` when the query fails. */
export async function grantedOptionalScopes(
    context: AuthenticatedContext
): Promise<GrantedOptionalScopes | null> {
    try {
        const { granted } = await context.scopes.query();
        const scopes = new AuthScopes(granted);
        return {
            proxy: scopes.has(PROXY_SCOPES),
            menu: scopes.has(MENU_SCOPES),
            pages: scopes.has(PAGE_SCOPES),
        };
    } catch (err) {
        log.error({ err }, "grantedOptionalScopes failed");
        return null;
    }
}

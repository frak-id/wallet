import { useCallback } from "react";
import { PAGE_SCOPES } from "../utils/pageScopes";

/** Opens Shopify's grant modal for the page scopes; resolves true only when granted. */
export function usePageScopes() {
    const requestPageScopes = useCallback(
        () =>
            shopify.scopes
                .request(PAGE_SCOPES)
                .then(({ result }) => result === "granted-all")
                .catch(() => false),
        []
    );

    return { requestPageScopes };
}

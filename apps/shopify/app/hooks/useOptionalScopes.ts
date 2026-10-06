import { useCallback } from "react";

/** The `requested` scopes not yet granted; a granted `write_x` also grants `read_x`. */
export function missingScopes(
    requested: readonly string[],
    granted: readonly string[]
): string[] {
    const held = new Set(granted);
    return requested.filter(
        (scope) =>
            !held.has(scope) &&
            !(
                scope.startsWith("read_") &&
                held.has(`write_${scope.slice("read_".length)}`)
            )
    );
}

/** Asks Shopify only for the optional scopes still missing; resolves true once all are granted. */
export function useOptionalScopes() {
    const ensureScopes = useCallback(
        async (scopes: string[]): Promise<boolean> => {
            if (scopes.length === 0) return true;
            try {
                const { granted } = await shopify.scopes.query();
                const missing = missingScopes(scopes, granted);
                if (missing.length === 0) return true;
                const { result } = await shopify.scopes.request(missing);
                return result === "granted-all";
            } catch {
                return false;
            }
        },
        []
    );

    return { ensureScopes };
}

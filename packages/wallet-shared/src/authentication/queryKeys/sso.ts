/**
 * Query keys for SSO-related queries
 */
export namespace ssoKey {
    /**
     * The base key
     */
    const base = "sso" as const;

    /**
     * Query keys for params
     */
    const paramsBase = "params-decompression" as const;
    export const params = {
        bySearchParams: (searchParams: string) =>
            [base, paramsBase, searchParams] as const,
    };

    /**
     * Mutation keys for demo
     */
    const demoBase = "demo" as const;
    export const demo = {
        login: [base, demoBase, "login"] as const,
    };

    /**
     * Mutation key for the SSO completion handoff to the merchant.
     */
    export const complete = [base, "complete"] as const;
}

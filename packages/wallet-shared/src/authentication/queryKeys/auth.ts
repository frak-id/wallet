/**
 * Query keys for authentication-related queries
 */
export namespace authKey {
    /**
     * The base key
     */
    const base = "auth" as const;

    /**
     * Mutation keys for login
     */
    const loginBase = "login" as const;
    export const login = [base, loginBase] as const;

    /**
     * Mutation keys for register
     */
    const registerBase = "register" as const;
    export const register = [base, registerBase] as const;

    /**
     * Mutation keys for demo
     */
    const demoBase = "demo" as const;
    export const demo = {
        login: [base, demoBase, "login"] as const,
        register: [base, demoBase, "register"] as const,
    };

    /**
     * Query keys for previous authenticators
     */
    const previousAuthenticatorsBase = "previousAuthenticators" as const;
    export const previousAuthenticators = [
        base,
        previousAuthenticatorsBase,
    ] as const;
}

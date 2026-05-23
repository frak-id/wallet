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

    /**
     * Mutation key for the pre-registration email availability check
     */
    const checkEmailBase = "checkEmail" as const;
    export const checkEmail = [base, checkEmailBase] as const;

    /**
     * Query/mutation keys for the post-auth "my email" flow
     */
    const myEmailBase = "myEmail" as const;
    export const myEmail = [base, myEmailBase] as const;
    export const associateEmail = [base, myEmailBase, "associate"] as const;

    /**
     * Keys for the same-device wallet-merge flow. Preview is read-only and
     * fully recomputable from the same inputs, so the React Query cache is
     * keyed by the target credential.
     */
    const mergeBase = "merge" as const;
    export const merge = {
        preview: (
            targetAuthenticatorId: string,
            requesterAuthenticatorId = ""
        ) =>
            [
                base,
                mergeBase,
                "preview",
                targetAuthenticatorId,
                requesterAuthenticatorId,
            ] as const,
        consent: [base, mergeBase, "consent"] as const,
        switchAuthenticator: [base, mergeBase, "switchAuthenticator"] as const,
        sendAddPassKey: [base, mergeBase, "sendAddPassKey"] as const,
        migrateLoserAssets: [base, mergeBase, "migrateLoserAssets"] as const,
        settle: [base, mergeBase, "settle"] as const,
    };
}

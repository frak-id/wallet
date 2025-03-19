/**
 * Mutation keys for authentication-related mutations
 */
export const authMutationKeys = {
    login: ["login"] as const,
    register: ["register"] as const,
    demo: {
        login: ["demo", "login"] as const,
        register: ["demo", "register"] as const,
    },
    previousAuthenticators: ["previousAuthenticators"] as const,
} as const;

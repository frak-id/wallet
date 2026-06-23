/**
 * Query keys for the onboarding module.
 */
export namespace onboardingKey {
    const base = "onboarding" as const;

    /**
     * Play Store install-referrer probe. Runs once per install on Tauri+Android,
     * resolves the merchant / pending ensure-action, then stays `staleTime:
     * Infinity` for the rest of the session.
     */
    export const installReferrer = [base, "install-referrer"] as const;
}

/**
 * Query / mutation keys for the version-gate module.
 */
export namespace versionKey {
    const base = "version" as const;

    /**
     * Backend-published `minVersion` per platform — hard floor below
     * which the wallet refuses to run.
     */
    export const minSupported = [base, "min-supported"] as const;

    /**
     * Native plugin status (iTunes Lookup on iOS, Play Core on Android).
     * Driven by both a polled `useQuery` and a native push listener that
     * writes back via `setQueryData(versionKey.nativeStatus, ...)`.
     */
    export const nativeStatus = [base, "native-status"] as const;

    /**
     * Mutation: deep-link to the platform store from the hard-update gate.
     */
    export const openStore = [base, "open-store"] as const;

    /**
     * Mutation: kick off Play Core's FLEXIBLE soft-update flow.
     */
    export const startSoftUpdate = [base, "start-soft-update"] as const;

    /**
     * Mutation: install + relaunch after a soft update finished downloading.
     */
    export const completeSoftUpdate = [base, "complete-soft-update"] as const;
}

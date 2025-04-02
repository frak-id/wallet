/**
 * Query keys for pairing queries / mutations
 */
export namespace pairingKey {
    /**
     * The base key
     */
    const base = "pairing" as const;

    /**
     * Initiate a pairing
     */
    export const initiate = [base, "initiation"];

    /**
     * Join a pairing request
     */
    export const join = (code: string) => [base, "join", code];
}

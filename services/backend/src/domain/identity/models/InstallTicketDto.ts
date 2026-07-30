import { t } from "@backend-utils";

/**
 * JWT payload for the install ticket, minted by `install-code/resolve` and
 * consumed by `/identity/ensure`. Fields must stay disjoint from other
 * contexts sharing the same JWT secret (e.g. `anonymousMerge`): verification
 * only checks signature + schema shape, not `iss`, so a mismatched shape is
 * what stops cross-context replay.
 */
export const InstallTicketDto = t.Object({
    aud: t.Literal("install-ticket"),
    // Anonymous fingerprint this ticket authenticates.
    sub: t.String(),
    // Merchant context this ticket is bound to.
    mid: t.String({ format: "uuid" }),
});

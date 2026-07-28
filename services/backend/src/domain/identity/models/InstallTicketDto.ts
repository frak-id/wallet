import { t } from "@backend-utils";

/**
 * JWT payload for the install ticket (README §5, "Ticket design").
 *
 * Minted unconditionally by `install-code/resolve` from the row's
 * `anonymousId` and consumed by `/identity/ensure`. The `aud` literal is
 * the cross-acceptance guard — `buildJwtContext.verify` only checks
 * signature + schema shape, not `iss` — so a token from any other context
 * sharing the same secret (e.g. `anonymousMerge`) fails this schema and
 * can never be replayed as an install ticket.
 */
export const InstallTicketDto = t.Object({
    aud: t.Literal("install-ticket"),
    // Anonymous fingerprint this ticket authenticates.
    sub: t.String(),
    // Merchant context this ticket is bound to.
    mid: t.String({ format: "uuid" }),
});

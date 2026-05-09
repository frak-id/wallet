import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Short-lived token issued to an origin device on `pairing-initiated` and
 * required to call `action=resume`. Binds the resume capability to the
 * device that initiated the pairing — without this token (which is only
 * sent over the original origin WS, never broadcast and never returned by
 * the public `/find/:id` endpoint), `pairingId` + `pairingCode` are not
 * enough to re-attach to a pairing.
 */
export const OriginResumeTokenDto = t.Object({
    kind: t.Literal("origin-resume"),
    pairingId: t.String(),
});

export type StaticOriginResumeTokenDto = Static<typeof OriginResumeTokenDto>;

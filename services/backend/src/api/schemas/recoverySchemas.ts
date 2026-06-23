import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Whether the current wallet's identity group has a stored recovery backup.
 * Dates (start/end) are read on-chain by the client, not stored here. The
 * blob's `created_at` is kept server-side for bookkeeping but not exposed.
 */
export const RecoveryStatusResponseSchema = t.Object({
    configured: t.Boolean(),
});
export type RecoveryStatusResponse = Static<
    typeof RecoveryStatusResponseSchema
>;

/**
 * The opaque, client-encrypted blob (or `null` when none is stored). Returned
 * only on explicit request so the client can run its local password test
 * (decrypt + GCM-tag check) without the password ever reaching the backend.
 */
export const RecoveryBlobResponseSchema = t.Object({
    blob: t.Union([t.String(), t.Null()]),
});
export type RecoveryBlobResponse = Static<typeof RecoveryBlobResponseSchema>;

export const SaveRecoveryBlobBodySchema = t.Object({
    blob: t.String({ minLength: 1, maxLength: 1024 }),
});
export type SaveRecoveryBlobBody = Static<typeof SaveRecoveryBlobBodySchema>;

export const SaveRecoveryResponseSchema = t.Object({
    status: t.Literal("success"),
});
export type SaveRecoveryResponse = Static<typeof SaveRecoveryResponseSchema>;

/**
 * Acknowledgement for a recovery blob deletion. Idempotent: returns `deleted`
 * whether or not a blob existed for the group (the client only deletes after a
 * successful on-chain disable, so a missing blob is a no-op, not an error).
 */
export const DeleteRecoveryResponseSchema = t.Object({
    status: t.Literal("deleted"),
});
export type DeleteRecoveryResponse = Static<
    typeof DeleteRecoveryResponseSchema
>;

export const RequestRecoveryEmailBodySchema = t.Object({
    email: t.String({ format: "email", maxLength: 320 }),
});
export type RequestRecoveryEmailBody = Static<
    typeof RequestRecoveryEmailBodySchema
>;

/**
 * Deliberately generic acknowledgement — identical whether or not the address
 * is registered, verified, or recoverable. The endpoint never confirms account
 * existence (anti-enumeration); the email itself is the only signal.
 */
export const RequestRecoveryEmailResponseSchema = t.Object({
    status: t.Literal("requested"),
});
export type RequestRecoveryEmailResponse = Static<
    typeof RequestRecoveryEmailResponseSchema
>;

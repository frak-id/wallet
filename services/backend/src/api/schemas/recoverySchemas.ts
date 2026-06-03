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

export const SaveRecoveryResponseSchema = t.Union([
    t.Object({ status: t.Literal("success") }),
    t.Object({ status: t.Literal("alreadyConfigured") }),
]);
export type SaveRecoveryResponse = Static<typeof SaveRecoveryResponseSchema>;

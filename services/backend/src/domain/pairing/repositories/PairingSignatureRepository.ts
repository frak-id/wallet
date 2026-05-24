import { db } from "@backend-infrastructure";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import type { Hex } from "viem";
import { pairingSignatureRequestTable } from "../db/schema";
import type { WsSignatureKind } from "../dto/WebsocketDirectMessage";

const SIGNATURE_REQUEST_TTL_MS = 10 * 60 * 1_000;

export type PairingSignatureRow =
    typeof pairingSignatureRequestTable.$inferSelect;

export class PairingSignatureRepository {
    /**
     * Live (unprocessed, unexpired) signature requests across the given
     * pairings. Used by target-side reconnect to replay any in-flight
     * prompts to the freshly attached WS.
     */
    async getPendingForPairings(
        pairingIds: string[]
    ): Promise<PairingSignatureRow[]> {
        if (pairingIds.length === 0) return [];
        return db.query.pairingSignatureRequestTable.findMany({
            where: and(
                inArray(pairingSignatureRequestTable.pairingId, pairingIds),
                isNull(pairingSignatureRequestTable.processedAt),
                gt(pairingSignatureRequestTable.expiresAt, new Date())
            ),
        });
    }

    /**
     * Idempotent insert: if a request with the same `(pairingId, requestId)`
     * already exists (because the origin's outbound queue replayed it after
     * a reconnect), do nothing.
     */
    async createIfNotExists(params: {
        pairingId: string;
        requestId: string;
        request: Hex;
        context: object | undefined;
        kind: WsSignatureKind | undefined;
    }): Promise<void> {
        await db
            .insert(pairingSignatureRequestTable)
            .values({
                pairingId: params.pairingId,
                requestId: params.requestId,
                request: params.request,
                context: params.context,
                kind: params.kind,
                expiresAt: new Date(Date.now() + SIGNATURE_REQUEST_TTL_MS),
            })
            .onConflictDoNothing();
    }

    /**
     * Mark a signature request processed. Stores the on-chain signature
     * payload when present; the `raw-assertion` kind (cross-device merge
     * consent forwarding) marks the row processed without persisting the
     * payload itself — it's a base64 WebAuthn assertion JSON that the
     * `customHex` (bytea) column cannot hold, and the origin's in-memory
     * tracking Map resolves synchronously off the topic broadcast.
     */
    async markProcessed(params: {
        pairingId: string;
        requestId: string;
        signature?: Hex;
    }): Promise<void> {
        await db
            .update(pairingSignatureRequestTable)
            .set({
                processedAt: new Date(),
                ...(params.signature !== undefined
                    ? { signature: params.signature }
                    : {}),
            })
            .where(
                and(
                    eq(
                        pairingSignatureRequestTable.requestId,
                        params.requestId
                    ),
                    eq(pairingSignatureRequestTable.pairingId, params.pairingId)
                )
            );
    }

    /**
     * Delete a signature request row regardless of processed state.
     * Used by `signature-reject` from either side.
     */
    async deleteByRequestId(params: {
        pairingId: string;
        requestId: string;
    }): Promise<void> {
        await db
            .delete(pairingSignatureRequestTable)
            .where(
                and(
                    eq(
                        pairingSignatureRequestTable.requestId,
                        params.requestId
                    ),
                    eq(pairingSignatureRequestTable.pairingId, params.pairingId)
                )
            );
    }

    /**
     * Delete a signature request row only if still unprocessed. Returns
     * `true` when a row was actually deleted — callers use that signal
     * to decide whether to emit a follow-up `signature-reject` event.
     */
    async deleteUnprocessed(params: {
        pairingId: string;
        requestId: string;
    }): Promise<boolean> {
        const deleted = await db
            .delete(pairingSignatureRequestTable)
            .where(
                and(
                    eq(
                        pairingSignatureRequestTable.pairingId,
                        params.pairingId
                    ),
                    eq(
                        pairingSignatureRequestTable.requestId,
                        params.requestId
                    ),
                    isNull(pairingSignatureRequestTable.processedAt)
                )
            )
            .returning({
                requestId: pairingSignatureRequestTable.requestId,
            });

        return deleted.length > 0;
    }
}

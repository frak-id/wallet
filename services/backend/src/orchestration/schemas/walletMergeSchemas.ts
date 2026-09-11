import { t } from "@backend-utils";
import type { Static } from "elysia";
import { WalletAuthResponseDto } from "../../domain/auth/models/WalletSessionDto";

/**
 * Weight summary surfaced by {@link MergePreviewSchema} so the wallet UI
 * can render "you'll gain N referrals" recaps. Mirrors the dimensions of
 * `IdentityWeightService.getGroupWeight`. Merchant ownership / admin
 * counts are weighted 10x in the backend winner-selection — the raw
 * counts are surfaced here so the UI can decide whether to call them out.
 */
export const MergeWeightSchema = t.Object({
    assetsCount: t.Number(),
    referralsCount: t.Number(),
    interactionsCount: t.Number(),
    merchantOwnershipsCount: t.Number(),
    merchantAdminshipsCount: t.Number(),
});
export type MergeWeightResponse = Static<typeof MergeWeightSchema>;

/**
 * Server-side recap of a pending wallet merge. Always derived from the same
 * deterministic inputs (`requesterWallet`, `targetAuthenticatorId`) so the
 * settle endpoint can recompute it without a stored snapshot.
 */
export const MergePreviewSchema = t.Object({
    requesterWallet: t.Address(),
    targetWallet: t.Address(),
    winner: t.Address(),
    loser: t.Address(),
    winnerAuthenticatorId: t.String(),
    winnerPublicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    loserAuthenticatorId: t.String(),
    loserPublicKey: t.Object({
        x: t.Hex(),
        y: t.Hex(),
    }),
    requesterWeight: MergeWeightSchema,
    targetWeight: MergeWeightSchema,
});
export type MergePreviewResponse = Static<typeof MergePreviewSchema>;

export const MergePreviewQuerySchema = t.Object({
    targetAuthenticatorId: t.String({ minLength: 1, maxLength: 512 }),
});

export const MergeSettleBodySchema = t.Object({
    targetAuthenticatorId: t.String({ minLength: 1, maxLength: 512 }),
    /**
     * Base64 webauthn assertion from the loser side over the merge-consent
     * challenge (`buildMergeConsentChallengeSlots`). Verified before any
     * on-chain read — without it a winner could absorb a victim's identity
     * from public credential data alone.
     */
    loserConsentSignature: t.String({ minLength: 1 }),
    /**
     * Cross-device merges only: makes the orchestrator publish
     * `merge-completed` on both pairing topics, the loser payload carrying a
     * fresh session. Same-device merges rebind via the response's `session`.
     */
    pairingId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
});

export const MergeSettleResponseSchema = t.Object({
    status: t.Literal("merged"),
    winner: t.Address(),
    loser: t.Address(),
    /**
     * Fresh session, present only when the requester authenticated with the
     * loser credential — that credential now binds to the winner wallet, so
     * the requester's JWT carries a stale `address`. Omitted when the
     * requester is the winner, or for out-of-band callers with no session.
     */
    session: t.Optional(WalletAuthResponseDto),
});
export type MergeSettleResponse = Static<typeof MergeSettleResponseSchema>;

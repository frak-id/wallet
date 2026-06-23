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
     * Base64-encoded webauthn assertion produced by the loser side over the
     * deterministic merge-consent challenge (see
     * `buildMergeConsentChallengeSlots`). Verified server-side before any
     * on-chain reads — closes the "absorb-other-user's-identity" path where
     * a malicious winner could craft the on-chain `addPasskey` against
     * public credential data without the victim consenting.
     */
    loserConsentSignature: t.String({ minLength: 1 }),
    /**
     * Set by the cross-device (Phase 2) merge flow. When present, the
     * orchestrator publishes a `merge-completed` event on both pairing
     * topics once settlement succeeds — the loser-side payload carries a
     * freshly-minted webauthn session so the loser device can swap its
     * stale one without a separate login. Omitted by same-device merges:
     * those rebind their session via the HTTP response's `session` field.
     */
    pairingId: t.Optional(t.String({ minLength: 1, maxLength: 128 })),
});

export const MergeSettleResponseSchema = t.Object({
    status: t.Literal("merged"),
    winner: t.Address(),
    loser: t.Address(),
    /**
     * Fresh wallet session minted for the requester, present only when the
     * requester authenticated with the loser credential. Post-merge the
     * loser credential's binding now points at the winner wallet, so the
     * requester's previous JWT references a stale `address`. The frontend
     * applies this session directly (`setSession`) rather than forcing a
     * re-login round-trip — the consent assertion verified at settle-time
     * is the security-equivalent proof of credential ownership.
     *
     * Omitted when the requester is the winner (their existing JWT already
     * resolves correctly) or when the merge was triggered by an out-of-band
     * caller with no session to rebind (Phase 2 reconciler retries).
     */
    session: t.Optional(WalletAuthResponseDto),
});
export type MergeSettleResponse = Static<typeof MergeSettleResponseSchema>;

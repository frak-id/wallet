import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Weight summary surfaced by {@link MergePreviewSchema} so the wallet UI
 * can render "you'll gain N referrals" recaps. Mirrors the three weight
 * dimensions of `IdentityWeightService.getGroupWeight`.
 */
export const MergeWeightSchema = t.Object({
    assetsCount: t.Number(),
    referralsCount: t.Number(),
    interactionsCount: t.Number(),
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
    onChainTxHash: t.Hex(),
    /**
     * Base64-encoded webauthn assertion produced by the loser side over the
     * deterministic merge-consent challenge (see
     * `buildMergeConsentChallengeSlots`). Verified server-side before any
     * on-chain reads — closes the "absorb-other-user's-identity" path where
     * a malicious winner could craft the on-chain `addPasskey` against
     * public credential data without the victim consenting.
     */
    loserConsentSignature: t.String({ minLength: 1 }),
});

export const MergeSettleResponseSchema = t.Object({
    status: t.Literal("merged"),
    winner: t.Address(),
    loser: t.Address(),
});
export type MergeSettleResponse = Static<typeof MergeSettleResponseSchema>;

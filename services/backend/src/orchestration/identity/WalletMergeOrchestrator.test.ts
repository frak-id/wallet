import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import type { WebAuthNValidatorReader } from "../../infrastructure/blockchain/WebAuthNValidatorReader";
import type { PairingRouterOrchestrator } from "../pairing/PairingRouterOrchestrator";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityWeightService } from "./IdentityWeightService";
import { WalletMergeOrchestrator } from "./WalletMergeOrchestrator";
import type { WalletSessionOrchestrator } from "./WalletSessionOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

/**
 * Regression tests for `WalletMergeOrchestrator` — the wallet-to-wallet
 * authenticated merge path. Priorities, per the review brief:
 *
 *  1. `detectSettledMerge` / `resolveSettledLoser` — a retried `settle()`
 *     against an already-settled merge must converge on the same success
 *     response instead of re-running the merge or throwing
 *     `MERGE_SAME_WALLET`; the JWT-replay cross-check must reject a
 *     mismatched loser claim.
 *  2. `settle()` cache invalidation — `invalidateWeight` must run for
 *     BOTH the absorbed group(s) and the winner group.
 *  3. `preview()` edge cases — tie-break outcome, and two wallets that
 *     already resolve to the same identity group.
 */

const REQUESTER_WALLET = "0x1111111111111111111111111111111111111111" as const;
const TARGET_WALLET = "0x2222222222222222222222222222222222222222" as const;
const REQUESTER_CRED = "requester-cred";
const TARGET_CRED = "target-cred";

function emptyWeight() {
    return {
        assetsCount: 0,
        referralsCount: 0,
        interactionsCount: 0,
        merchantOwnershipsCount: 0,
        merchantAdminshipsCount: 0,
    };
}

function credentialRow(id: string, x: string, y: string) {
    return {
        _id: id,
        smartWalletAddress: REQUESTER_WALLET,
        publicKey: { x, y },
        transports: [],
    };
}

function makeMergeResult(
    overrides: Partial<{
        mergedGroupIds: string[];
        previouslyMergedGroupIds: string[];
        affectedMerchantIds: string[];
    }> = {}
) {
    return {
        success: true,
        movedNodes: 0,
        migratedPurchases: 0,
        migratedPurchaseClaims: 0,
        migratedInteractionLogs: 0,
        migratedAssetLogs: 0,
        migratedAffiliateAttributions: 0,
        deletedConflictingAffiliateAttributions: 0,
        migratedReferralLinksReferrer: 0,
        migratedReferralLinksReferee: 0,
        softDeletedConflictingReferralLinks: 0,
        softDeletedSelfLoopReferralLinks: 0,
        movedPushTokens: 0,
        deletedPushTokens: 0,
        revokedConflictingReferralCodes: 0,
        migratedReferralCodes: 0,
        migratedMerchantOwnerships: 0,
        migratedMerchantAdminships: 0,
        deletedLoserMerchantAdminships: 0,
        deletedMerchantOwnershipTransfers: 0,
        affectedMerchantIds: [],
        mergedGroupIds: [],
        previouslyMergedGroupIds: [],
        ...overrides,
    };
}

function makeOrchestrator() {
    const authenticatorRepository = {
        getByCredentialId: vi.fn(),
    };
    const walletBindingRepository = {
        getActiveBinding: vi.fn(),
        getLastUnlinkedBinding: vi.fn(),
        repointBinding: vi.fn(),
    };
    const identityRepository = {
        findGroupByIdentity: vi.fn(),
        invalidateCachesForGroup: vi.fn(),
    };
    const identityWeightService = {
        getGroupWeight: vi.fn(),
        invalidateWeight: vi.fn(),
    };
    const identityMergeService = {
        mergeGroupsByWallet: vi.fn(),
        clearReferralChainCache: vi.fn(),
        invalidateMerchantCaches: vi.fn(),
    };
    const webAuthNValidatorReader = {
        getPasskey: vi.fn(),
    };
    const webAuthNService = {
        verifyConsentSignature: vi.fn(),
    };
    const walletSessionOrchestrator = {
        mintSessionForExplicitWallet: vi.fn(),
    };
    const pairingRouterOrchestrator = {
        broadcastMergeCompleted: vi.fn(),
    };

    const orchestrator = new WalletMergeOrchestrator(
        authenticatorRepository as unknown as AuthenticatorRepository,
        walletBindingRepository as unknown as WalletBindingRepository,
        identityRepository as unknown as IdentityRepository,
        identityWeightService as unknown as IdentityWeightService,
        identityMergeService as unknown as IdentityMergeService,
        webAuthNValidatorReader as unknown as WebAuthNValidatorReader,
        webAuthNService as unknown as WebAuthNService,
        walletSessionOrchestrator as unknown as WalletSessionOrchestrator,
        pairingRouterOrchestrator as unknown as PairingRouterOrchestrator
    );

    return {
        orchestrator,
        authenticatorRepository,
        walletBindingRepository,
        identityRepository,
        identityWeightService,
        identityMergeService,
        webAuthNValidatorReader,
        webAuthNService,
        walletSessionOrchestrator,
        pairingRouterOrchestrator,
    };
}

/** Wires the two active bindings preview()/detectSettledMerge() read. */
function stubActiveBindings(
    ctx: ReturnType<typeof makeOrchestrator>,
    bindings: Record<string, { smartWalletAddress: string } | null>
) {
    ctx.walletBindingRepository.getActiveBinding.mockImplementation(
        async ({ credentialId }: { credentialId: string }) =>
            bindings[credentialId] ?? null
    );
}

describe("WalletMergeOrchestrator.preview", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("throws MERGE_SAME_CREDENTIAL without touching any repository", async () => {
        await expect(
            ctx.orchestrator.preview({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: REQUESTER_CRED,
            })
        ).rejects.toMatchObject({ code: "MERGE_SAME_CREDENTIAL", status: 400 });

        expect(
            ctx.walletBindingRepository.getActiveBinding
        ).not.toHaveBeenCalled();
    });

    it("throws MERGE_TARGET_BINDING_NOT_FOUND when the target credential has no active binding", async () => {
        stubActiveBindings(ctx, { [TARGET_CRED]: null });

        await expect(
            ctx.orchestrator.preview({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
            })
        ).rejects.toMatchObject({
            code: "MERGE_TARGET_BINDING_NOT_FOUND",
            status: 404,
        });
    });

    it("throws MERGE_SAME_WALLET when the target credential's wallet equals the requester wallet", async () => {
        stubActiveBindings(ctx, {
            [TARGET_CRED]: { smartWalletAddress: REQUESTER_WALLET },
        });

        await expect(
            ctx.orchestrator.preview({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
            })
        ).rejects.toMatchObject({ code: "MERGE_SAME_WALLET", status: 409 });
    });

    it("throws MERGE_REQUESTER_GROUP_NOT_FOUND when the requester wallet has no identity group", async () => {
        stubActiveBindings(ctx, {
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.preview({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
            })
        ).rejects.toMatchObject({
            code: "MERGE_REQUESTER_GROUP_NOT_FOUND",
            status: 404,
        });
    });

    it("tie-break: on an exact weight tie the requester (first argument) wins", async () => {
        stubActiveBindings(ctx, {
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) =>
                value === REQUESTER_WALLET
                    ? { id: "group-requester" }
                    : { id: "group-target" }
        );
        ctx.identityWeightService.getGroupWeight.mockResolvedValue(
            emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );

        const result = await ctx.orchestrator.preview({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
        });

        expect(result.winner).toBe(REQUESTER_WALLET);
        expect(result.loser).toBe(TARGET_WALLET);
        expect(result.winnerAuthenticatorId).toBe(REQUESTER_CRED);
        expect(result.loserAuthenticatorId).toBe(TARGET_CRED);
    });

    it("tie-break: a heavier target wins and swaps winner/loser roles", async () => {
        stubActiveBindings(ctx, {
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) =>
                value === REQUESTER_WALLET
                    ? { id: "group-requester" }
                    : { id: "group-target" }
        );
        ctx.identityWeightService.getGroupWeight.mockImplementation(
            async (groupId: string) =>
                groupId === "group-target"
                    ? { ...emptyWeight(), assetsCount: 10 }
                    : emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );

        const result = await ctx.orchestrator.preview({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
        });

        expect(result.winner).toBe(TARGET_WALLET);
        expect(result.loser).toBe(REQUESTER_WALLET);
        expect(result.winnerAuthenticatorId).toBe(TARGET_CRED);
        expect(result.loserAuthenticatorId).toBe(REQUESTER_CRED);
    });

    it("does not special-case two wallets that already resolve to the same identity group", async () => {
        // Both wallets already belong to the same (previously-merged)
        // identity group. `preview()` has no group-equality guard — it
        // only checks wallet-address equality — so it still runs the
        // tie-break and returns a normal preview rather than throwing.
        // Documents current behavior; not asserted as a "correct" design.
        stubActiveBindings(ctx, {
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue({
            id: "shared-group",
        });
        ctx.identityWeightService.getGroupWeight.mockResolvedValue(
            emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );

        await expect(
            ctx.orchestrator.preview({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
            })
        ).resolves.toMatchObject({
            winner: REQUESTER_WALLET,
            loser: TARGET_WALLET,
        });
    });
});

describe("WalletMergeOrchestrator.settle — idempotent retry detection", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("detects an already-settled merge and returns success without re-merging", async () => {
        // Both credentials' active bindings already point at the winner —
        // a retry after a successful settle (dropped HTTP response, etc).
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: REQUESTER_WALLET },
        });
        // Requester's JWT still carries the stale pre-merge (loser) wallet.
        ctx.walletBindingRepository.getLastUnlinkedBinding.mockResolvedValue({
            reason: "merged",
            smartWalletAddress: TARGET_WALLET,
        });
        ctx.walletSessionOrchestrator.mintSessionForExplicitWallet.mockResolvedValue(
            { token: "fresh-session" }
        );

        const result = await ctx.orchestrator.settle({
            requesterWallet: TARGET_WALLET,
            requesterAuthenticatorId: TARGET_CRED,
            targetAuthenticatorId: REQUESTER_CRED,
            loserConsentSignature: "sig",
        });

        expect(result).toEqual({
            status: "merged",
            winner: REQUESTER_WALLET,
            loser: TARGET_WALLET,
            session: { token: "fresh-session" },
        });
        // The normal settle path (consent check, on-chain read, transaction)
        // must never run on the idempotent-retry path.
        expect(
            ctx.webAuthNService.verifyConsentSignature
        ).not.toHaveBeenCalled();
        expect(ctx.webAuthNValidatorReader.getPasskey).not.toHaveBeenCalled();
        expect(
            ctx.walletBindingRepository.repointBinding
        ).not.toHaveBeenCalled();
        expect(
            ctx.identityMergeService.mergeGroupsByWallet
        ).not.toHaveBeenCalled();
        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).toHaveBeenCalledWith({
            credentialId: TARGET_CRED,
            walletAddress: REQUESTER_WALLET,
        });
    });

    it("re-broadcasts merge-completed on an idempotent retry carrying a pairingId", async () => {
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: REQUESTER_WALLET },
        });
        ctx.walletBindingRepository.getLastUnlinkedBinding.mockResolvedValue({
            reason: "merged",
            smartWalletAddress: TARGET_WALLET,
        });
        ctx.walletSessionOrchestrator.mintSessionForExplicitWallet.mockResolvedValue(
            { token: "fresh-session" }
        );

        await ctx.orchestrator.settle({
            requesterWallet: TARGET_WALLET,
            requesterAuthenticatorId: TARGET_CRED,
            targetAuthenticatorId: REQUESTER_CRED,
            loserConsentSignature: "sig",
            pairingId: "pairing-1",
        });

        expect(
            ctx.pairingRouterOrchestrator.broadcastMergeCompleted
        ).toHaveBeenCalledWith({
            pairingId: "pairing-1",
            winner: REQUESTER_WALLET,
            loser: TARGET_WALLET,
            loserAuthenticatorId: TARGET_CRED,
            loserSession: { token: "fresh-session" },
        });
    });

    it("JWT-replay cross-check: rejects a requester claiming a wallet that doesn't match the loser's unlinked binding", async () => {
        // Both bindings already resolved to the winner (a real merge did
        // settle), but the attacker replays a stale JWT claiming a wallet
        // that does NOT match the credential's actual unlinked history.
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: REQUESTER_WALLET },
        });
        const ACTUAL_LOSER_WALLET =
            "0x3333333333333333333333333333333333333333" as const;
        const CLAIMED_WALLET =
            "0x4444444444444444444444444444444444444444" as const;
        ctx.walletBindingRepository.getLastUnlinkedBinding.mockResolvedValue({
            reason: "merged",
            smartWalletAddress: ACTUAL_LOSER_WALLET,
        });
        // Fresh-flow fallthrough will hit preview(); force a deterministic,
        // identifiable failure there rather than fully re-mocking success.
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: CLAIMED_WALLET,
                requesterAuthenticatorId: TARGET_CRED,
                targetAuthenticatorId: REQUESTER_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toMatchObject({
            code: "MERGE_REQUESTER_GROUP_NOT_FOUND",
        });

        // No idempotent short-circuit session was minted for the mismatched
        // claim — the mismatch must fall through to the normal flow instead
        // of silently upgrading a replayed JWT into a winner-bound session.
        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).not.toHaveBeenCalled();
        expect(
            ctx.pairingRouterOrchestrator.broadcastMergeCompleted
        ).not.toHaveBeenCalled();
    });

    it("falls through to the normal flow when the unlinked binding reason isn't 'merged' (ambiguous state)", async () => {
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: REQUESTER_WALLET },
        });
        ctx.walletBindingRepository.getLastUnlinkedBinding.mockResolvedValue({
            reason: "initial",
            smartWalletAddress: TARGET_WALLET,
        });
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: TARGET_WALLET,
                requesterAuthenticatorId: TARGET_CRED,
                targetAuthenticatorId: REQUESTER_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toMatchObject({ code: "MERGE_REQUESTER_GROUP_NOT_FOUND" });
        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).not.toHaveBeenCalled();
    });

    it("skips settled-merge detection entirely when requester and target credential ids are identical", async () => {
        await expect(
            ctx.orchestrator.settle({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: REQUESTER_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toMatchObject({ code: "MERGE_SAME_CREDENTIAL" });

        expect(
            ctx.walletBindingRepository.getActiveBinding
        ).not.toHaveBeenCalled();
    });
});

describe("WalletMergeOrchestrator.settle — cache invalidation ordering", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    function stubFreshMergeUpTo(
        params: { winnerIsRequester: boolean } = { winnerIsRequester: true }
    ) {
        // Fresh merge: bindings don't already share a wallet, so
        // detectSettledMerge returns null and the normal flow runs.
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) =>
                value === REQUESTER_WALLET
                    ? { id: "group-requester" }
                    : { id: "group-target" }
        );
        ctx.identityWeightService.getGroupWeight.mockImplementation(
            async (groupId: string) =>
                (groupId === "group-requester") === params.winnerIsRequester
                    ? { ...emptyWeight(), assetsCount: 10 }
                    : emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(true);
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue({
            x: 1n,
            y: 2n,
        });
    }

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("invalidates weight for BOTH the absorbed group(s) and the winner group, absorbed first", async () => {
        stubFreshMergeUpTo({ winnerIsRequester: true });
        ctx.identityMergeService.mergeGroupsByWallet.mockResolvedValue(
            makeMergeResult({
                mergedGroupIds: ["group-target"],
                previouslyMergedGroupIds: ["group-previously-absorbed"],
                affectedMerchantIds: ["merchant-1"],
            })
        );

        const result = await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
        });

        expect(result).toMatchObject({
            status: "merged",
            winner: REQUESTER_WALLET,
            loser: TARGET_WALLET,
        });

        expect(ctx.identityWeightService.invalidateWeight).toHaveBeenCalledWith(
            "group-target"
        );
        expect(ctx.identityWeightService.invalidateWeight).toHaveBeenCalledWith(
            "group-previously-absorbed"
        );
        expect(ctx.identityWeightService.invalidateWeight).toHaveBeenCalledWith(
            "group-requester"
        );
        expect(
            ctx.identityWeightService.invalidateWeight
        ).toHaveBeenCalledTimes(3);

        // Absorbed-group invalidation (settle():321) happens before the
        // winner-group invalidation (settle():332).
        const calls = ctx.identityWeightService.invalidateWeight.mock.calls;
        const winnerCallIndex = calls.findIndex(
            (c) => c[0] === "group-requester"
        );
        const absorbedCallIndexes = calls
            .map((c, i) => (c[0] !== "group-requester" ? i : -1))
            .filter((i) => i >= 0);
        for (const absorbedIndex of absorbedCallIndexes) {
            expect(absorbedIndex).toBeLessThan(winnerCallIndex);
        }

        // Cache eviction for the absorbed groups (mapping groupId → wallet).
        expect(
            ctx.identityRepository.invalidateCachesForGroup
        ).toHaveBeenCalledWith("group-target");
        expect(
            ctx.identityRepository.invalidateCachesForGroup
        ).toHaveBeenCalledWith("group-previously-absorbed");
        expect(
            ctx.identityRepository.invalidateCachesForGroup
        ).toHaveBeenCalledTimes(2);
        // The winner group's mapping is NOT dropped via invalidateCachesForGroup
        // (only its weight is refreshed).
        expect(
            ctx.identityRepository.invalidateCachesForGroup
        ).not.toHaveBeenCalledWith("group-requester");

        expect(
            ctx.identityMergeService.clearReferralChainCache
        ).toHaveBeenCalledTimes(1);
        expect(
            ctx.identityMergeService.invalidateMerchantCaches
        ).toHaveBeenCalledWith(["merchant-1"]);
    });

    it("still invalidates the winner group's weight when the merge is a self-merge no-op (no absorbed groups)", async () => {
        // Mirrors IdentityMergeService.mergeGroupsByWallet's own no-op path:
        // winner and loser wallets already share an identity group, so the
        // merge result carries no absorbed groups at all.
        stubFreshMergeUpTo({ winnerIsRequester: true });
        ctx.identityMergeService.mergeGroupsByWallet.mockResolvedValue(
            makeMergeResult()
        );

        await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
        });

        expect(
            ctx.identityRepository.invalidateCachesForGroup
        ).not.toHaveBeenCalled();
        expect(
            ctx.identityWeightService.invalidateWeight
        ).toHaveBeenCalledTimes(1);
        expect(ctx.identityWeightService.invalidateWeight).toHaveBeenCalledWith(
            "group-requester"
        );
    });

    it("skips the winner-group invalidation when the post-merge wallet lookup can't resolve a group", async () => {
        stubFreshMergeUpTo({ winnerIsRequester: true });
        ctx.identityMergeService.mergeGroupsByWallet.mockResolvedValue(
            makeMergeResult({ mergedGroupIds: ["group-target"] })
        );
        // First two calls (requester/target group lookup in preview) return
        // real groups; the post-commit winner-group lookup returns null.
        let call = 0;
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) => {
                call++;
                if (call <= 2) {
                    return value === REQUESTER_WALLET
                        ? { id: "group-requester" }
                        : { id: "group-target" };
                }
                return null;
            }
        );

        await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
        });

        expect(
            ctx.identityWeightService.invalidateWeight
        ).toHaveBeenCalledTimes(1);
        expect(ctx.identityWeightService.invalidateWeight).toHaveBeenCalledWith(
            "group-target"
        );
    });
});

describe("WalletMergeOrchestrator.settle — consent and on-chain verification", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) =>
                value === REQUESTER_WALLET
                    ? { id: "group-requester" }
                    : { id: "group-target" }
        );
        ctx.identityWeightService.getGroupWeight.mockImplementation(
            async (groupId: string) =>
                groupId === "group-requester"
                    ? { ...emptyWeight(), assetsCount: 10 }
                    : emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );
    });

    it("throws MERGE_INVALID_CONSENT and never opens a transaction when consent fails", async () => {
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(false);

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
                loserConsentSignature: "bad-sig",
            })
        ).rejects.toMatchObject({ code: "MERGE_INVALID_CONSENT", status: 401 });

        expect(ctx.webAuthNValidatorReader.getPasskey).not.toHaveBeenCalled();
        expect(
            ctx.walletBindingRepository.repointBinding
        ).not.toHaveBeenCalled();
        expect(
            ctx.identityWeightService.invalidateWeight
        ).not.toHaveBeenCalled();
    });

    it("throws MERGE_ON_CHAIN_PASSKEY_MISSING when the validator has no passkey for the loser", async () => {
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(true);
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue(null);

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toMatchObject({
            code: "MERGE_ON_CHAIN_PASSKEY_MISSING",
            status: 422,
        });

        expect(
            ctx.walletBindingRepository.repointBinding
        ).not.toHaveBeenCalled();
    });

    it("throws MERGE_ON_CHAIN_PASSKEY_MISMATCH when the on-chain pubkey doesn't match the stored one", async () => {
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(true);
        // Preview's loser (target) credential pubkey is 0x1/0x2 (credentialRow
        // above); the on-chain read disagrees.
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue({
            x: 999n,
            y: 999n,
        });

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toMatchObject({
            code: "MERGE_ON_CHAIN_PASSKEY_MISMATCH",
            status: 422,
        });

        expect(
            ctx.walletBindingRepository.repointBinding
        ).not.toHaveBeenCalled();
    });

    it("propagates a transaction failure and never runs post-commit cache invalidation", async () => {
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(true);
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue({
            x: 1n,
            y: 2n,
        });
        ctx.identityMergeService.mergeGroupsByWallet.mockRejectedValue(
            new Error("db exploded mid-transaction")
        );

        await expect(
            ctx.orchestrator.settle({
                requesterWallet: REQUESTER_WALLET,
                requesterAuthenticatorId: REQUESTER_CRED,
                targetAuthenticatorId: TARGET_CRED,
                loserConsentSignature: "sig",
            })
        ).rejects.toThrow("db exploded mid-transaction");

        expect(
            ctx.identityWeightService.invalidateWeight
        ).not.toHaveBeenCalled();
        expect(
            ctx.identityMergeService.clearReferralChainCache
        ).not.toHaveBeenCalled();
        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).not.toHaveBeenCalled();
    });
});

describe("WalletMergeOrchestrator.settle — loser session and cross-device broadcast", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
        // Target wins this time, so the requester (bound to REQUESTER_CRED)
        // is the loser and must receive a fresh session.
        stubActiveBindings(ctx, {
            [REQUESTER_CRED]: { smartWalletAddress: REQUESTER_WALLET },
            [TARGET_CRED]: { smartWalletAddress: TARGET_WALLET },
        });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ value }: { value: string }) =>
                value === REQUESTER_WALLET
                    ? { id: "group-requester" }
                    : { id: "group-target" }
        );
        ctx.identityWeightService.getGroupWeight.mockImplementation(
            async (groupId: string) =>
                groupId === "group-target"
                    ? { ...emptyWeight(), assetsCount: 10 }
                    : emptyWeight()
        );
        ctx.authenticatorRepository.getByCredentialId.mockImplementation(
            async (id: string) => credentialRow(id, "0x1", "0x2")
        );
        ctx.webAuthNService.verifyConsentSignature.mockResolvedValue(true);
        ctx.webAuthNValidatorReader.getPasskey.mockResolvedValue({
            x: 1n,
            y: 2n,
        });
        ctx.identityMergeService.mergeGroupsByWallet.mockResolvedValue(
            makeMergeResult({ mergedGroupIds: ["group-requester"] })
        );
        ctx.walletSessionOrchestrator.mintSessionForExplicitWallet.mockResolvedValue(
            { token: "loser-session" }
        );
    });

    it("mints and returns a fresh session for the requester when the requester is the loser", async () => {
        const result = await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
        });

        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).toHaveBeenCalledWith({
            credentialId: REQUESTER_CRED,
            walletAddress: TARGET_WALLET,
        });
        expect(result).toMatchObject({
            status: "merged",
            winner: TARGET_WALLET,
            loser: REQUESTER_WALLET,
            session: { token: "loser-session" },
        });
        expect(
            ctx.pairingRouterOrchestrator.broadcastMergeCompleted
        ).not.toHaveBeenCalled();
    });

    it("broadcasts merge-completed on both pairing topics when a pairingId is supplied", async () => {
        const result = await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
            pairingId: "pairing-42",
        });

        expect(
            ctx.pairingRouterOrchestrator.broadcastMergeCompleted
        ).toHaveBeenCalledWith({
            pairingId: "pairing-42",
            winner: TARGET_WALLET,
            loser: REQUESTER_WALLET,
            loserAuthenticatorId: REQUESTER_CRED,
            loserSession: { token: "loser-session" },
        });
        expect(result.session).toEqual({ token: "loser-session" });
    });

    it("does not mint a loser session or broadcast when the requester is the winner and no pairingId is present", async () => {
        // Swap weighting so the requester wins; loser is the target side —
        // requester is not the loser and there's no pairing, so no session
        // should be minted at all.
        ctx.identityWeightService.getGroupWeight.mockImplementation(
            async (groupId: string) =>
                groupId === "group-requester"
                    ? { ...emptyWeight(), assetsCount: 10 }
                    : emptyWeight()
        );

        const result = await ctx.orchestrator.settle({
            requesterWallet: REQUESTER_WALLET,
            requesterAuthenticatorId: REQUESTER_CRED,
            targetAuthenticatorId: TARGET_CRED,
            loserConsentSignature: "sig",
        });

        expect(
            ctx.walletSessionOrchestrator.mintSessionForExplicitWallet
        ).not.toHaveBeenCalled();
        expect(
            ctx.pairingRouterOrchestrator.broadcastMergeCompleted
        ).not.toHaveBeenCalled();
        expect(result.session).toBeUndefined();
    });
});

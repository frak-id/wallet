import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityMergeService } from "./IdentityMergeService";
import { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityWeightService } from "./IdentityWeightService";
import type { GroupWeight } from "./types";

/**
 * Regression tests for the two independent WALLET_CONFLICT throw sites
 * (README §9 open question 1, closed by §3.8):
 *
 *  - `associate()` — reached from `/merge/execute` via
 *    `AnonymousMergeOrchestrator.executeMerge`. Checks the two resolved
 *    weights inline.
 *  - `resolveAndAssociate()` — reached from `/identity/ensure` (and, before
 *    §3.9, from `track/*`). Internally delegates to
 *    `IdentityWeightService.determineAnchorFromMultiple` — a *different*
 *    throw site than the one `associate()` uses.
 *
 * Both must refuse a merge between two groups holding two different
 * wallets. This is the guard that stops a hostile merge from reassigning a
 * victim's rewards once they finally connect their own wallet (README §1,
 * "the consequence that is worse than theft") — and, per §3.8, the backend
 * half of turning that refusal into a clean, non-retryable error instead of
 * a silent 7-day retry loop on the wallet.
 */

const WALLET_A = "0x1111111111111111111111111111111111111111" as const;
const WALLET_B = "0x2222222222222222222222222222222222222222" as const;

function weight(overrides: Partial<GroupWeight>): GroupWeight {
    return {
        groupId: "group-1",
        hasWallet: false,
        wallet: null,
        assetsCount: 0,
        referralsCount: 0,
        interactionsCount: 0,
        merchantOwnershipsCount: 0,
        merchantAdminshipsCount: 0,
        ...overrides,
    };
}

function makeOrchestrator() {
    const identityRepository = {
        findGroupByIdentity: vi.fn(),
        invalidateCachesForGroup: vi.fn(),
    };
    const weightService = {
        getGroupWeight: vi.fn(),
        determineAnchor: vi.fn(),
        determineAnchorFromMultiple: vi.fn(),
        invalidateWeight: vi.fn(),
    };
    const mergeService = {
        mergeGroups: vi.fn(),
    };

    const orchestrator = new IdentityOrchestrator(
        identityRepository as unknown as IdentityRepository,
        weightService as unknown as IdentityWeightService,
        mergeService as unknown as IdentityMergeService
    );

    return { orchestrator, identityRepository, weightService, mergeService };
}

describe("WALLET_CONFLICT regression — both throw sites", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("associate() — the /merge/execute throw site", () => {
        it("refuses to merge two groups holding two different wallets", async () => {
            const ctx = makeOrchestrator();
            ctx.weightService.getGroupWeight.mockImplementation(
                async (groupId: string) =>
                    groupId === "group-a"
                        ? weight({
                              groupId: "group-a",
                              hasWallet: true,
                              wallet: WALLET_A,
                          })
                        : weight({
                              groupId: "group-b",
                              hasWallet: true,
                              wallet: WALLET_B,
                          })
            );

            await expect(
                ctx.orchestrator.associate("group-a", "group-b")
            ).rejects.toMatchObject({ code: "WALLET_CONFLICT", status: 409 });

            // The conflict must be detected before any merge write happens.
            expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
        });

        it("allows the merge when only one side has a wallet", async () => {
            const ctx = makeOrchestrator();
            ctx.weightService.getGroupWeight.mockImplementation(
                async (groupId: string) =>
                    groupId === "group-a"
                        ? weight({
                              groupId: "group-a",
                              hasWallet: true,
                              wallet: WALLET_A,
                          })
                        : weight({ groupId: "group-b" })
            );
            ctx.weightService.determineAnchor.mockReturnValue({
                anchorGroupId: "group-a",
                mergingGroupId: "group-b",
                anchorWallet: WALLET_A,
            });
            ctx.mergeService.mergeGroups.mockResolvedValue(undefined);

            const result = await ctx.orchestrator.associate(
                "group-a",
                "group-b"
            );

            expect(result).toEqual({ finalGroupId: "group-a", merged: true });
            expect(ctx.mergeService.mergeGroups).toHaveBeenCalledWith({
                anchorGroupId: "group-a",
                mergingGroupIds: ["group-b"],
            });
        });
    });

    describe("resolveAndAssociate() — the /identity/ensure throw site", () => {
        it("refuses to merge when the resolved groups hold two different wallets", async () => {
            const ctx = makeOrchestrator();
            // Two distinct identity nodes resolve to two distinct groups —
            // exactly the shape produced by ensure.ts's
            // `buildIdentityNodes({ walletAddress, clientId, merchantId })`
            // when the anonymous id was already hijacked into a group with
            // a different wallet than the one authenticating now.
            ctx.identityRepository.findGroupByIdentity.mockImplementation(
                async (params: { type: string }) =>
                    params.type === "wallet"
                        ? { id: "group-wallet" }
                        : { id: "group-anon" }
            );
            ctx.weightService.getGroupWeight.mockImplementation(
                async (groupId: string) =>
                    groupId === "group-wallet"
                        ? weight({
                              groupId: "group-wallet",
                              hasWallet: true,
                              wallet: WALLET_A,
                          })
                        : weight({
                              groupId: "group-anon",
                              hasWallet: true,
                              wallet: WALLET_B,
                          })
            );
            // The real IdentityWeightService.determineAnchorFromMultiple
            // throws HttpError.conflict("WALLET_CONFLICT", ...) — this is a
            // SEPARATE throw site from associate()'s inline check above.
            const { HttpError } = await import("@backend-utils");
            ctx.weightService.determineAnchorFromMultiple.mockImplementation(
                () => {
                    throw HttpError.conflict(
                        "WALLET_CONFLICT",
                        "Cannot merge groups with different wallets"
                    );
                }
            );

            await expect(
                ctx.orchestrator.resolveAndAssociate([
                    { type: "wallet", value: WALLET_A },
                    {
                        type: "anonymous_fingerprint",
                        value: "anon-1",
                        merchantId: "merchant-1",
                    },
                ])
            ).rejects.toMatchObject({ code: "WALLET_CONFLICT", status: 409 });

            expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
        });
    });
});

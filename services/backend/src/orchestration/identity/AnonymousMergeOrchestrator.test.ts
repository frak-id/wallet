import { HttpError } from "@backend-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { AnonymousMergeService } from "../../domain/identity/services/AnonymousMergeService";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import { AnonymousMergeOrchestrator } from "./AnonymousMergeOrchestrator";
import type { IdentityOrchestrator } from "./IdentityOrchestrator";

/**
 * `initiateMerge`'s `sourceAnonymousId` arm is LATCH-GATED: a valid proof,
 * when present, is verified; when absent, the id is allowed unless it has
 * previously latched. `executeMerge`'s `targetAnonymousId` arm uses the
 * identical policy: legacy ids, which can never produce a proof, must keep
 * working as merge sources AND targets until they first prove themselves.
 * The wallet-session arm of `initiateMerge` (no `sourceAnonymousId`) is
 * never gated at all.
 */

const MERCHANT_ID = "merchant-1";
const MERGE_TOKEN = "merge-token";

function makeOrchestrator() {
    const identityRepository = {
        findGroupByIdentity: vi.fn(),
        findNodeByIdentity: vi.fn(),
        markProofSeen: vi.fn(),
    };
    const anonymousMergeService = {
        generateToken: vi.fn(),
        validateToken: vi.fn(),
    };
    const identityOrchestrator = {
        resolveAndAssociate: vi.fn(),
        associate: vi.fn(),
    };
    const verify = vi.fn();
    const identityProofService = {
        verify,
        // Mirrors the real service: verify, then 403 on failure.
        verifyOrThrow: vi.fn(async (params: unknown) => {
            const result = await verify(params);
            if (!result?.valid) {
                throw HttpError.forbidden(
                    "PROOF_INVALID",
                    "Identity proof failed verification"
                );
            }
        }),
        hashMergeToken: vi.fn(),
    };

    const orchestrator = new AnonymousMergeOrchestrator(
        anonymousMergeService as unknown as AnonymousMergeService,
        identityRepository as unknown as IdentityRepository,
        identityOrchestrator as unknown as IdentityOrchestrator,
        identityProofService as unknown as IdentityProofService
    );

    return {
        orchestrator,
        identityRepository,
        anonymousMergeService,
        identityOrchestrator,
        identityProofService,
    };
}

describe("AnonymousMergeOrchestrator — Phase 4a proof enforcement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initiateMerge — sourceAnonymousId branch (latch-gated)", () => {
        it("allows an unlatched legacy/derived sourceAnonymousId with no proof at all", async () => {
            const ctx = makeOrchestrator();
            ctx.identityRepository.findNodeByIdentity.mockResolvedValue({
                proofSeenAt: null,
            });
            ctx.identityOrchestrator.resolveAndAssociate.mockResolvedValue({
                finalGroupId: "group-1",
            });
            ctx.anonymousMergeService.generateToken.mockResolvedValue({
                mergeToken: MERGE_TOKEN,
                expiresAt: new Date(),
            });

            await expect(
                ctx.orchestrator.initiateMerge({
                    merchantId: MERCHANT_ID,
                    sourceAnonymousId: "legacy-id",
                })
            ).resolves.toMatchObject({ mergeToken: MERGE_TOKEN });

            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).toHaveBeenCalled();
            expect(ctx.identityProofService.verify).not.toHaveBeenCalled();
            // No proof was presented (fail-open branch), so the latch must
            // NOT be written — that would permanently lock this legacy id
            // out of ever being a merge source again.
            expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
        });

        it("rejects a LATCHED sourceAnonymousId with no proof", async () => {
            const ctx = makeOrchestrator();
            ctx.identityRepository.findNodeByIdentity.mockResolvedValue({
                proofSeenAt: new Date(),
            });

            await expect(
                ctx.orchestrator.initiateMerge({
                    merchantId: MERCHANT_ID,
                    sourceAnonymousId: "latched-id",
                })
            ).rejects.toMatchObject({ code: "PROOF_REQUIRED", status: 403 });

            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).not.toHaveBeenCalled();
            expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
        });

        it("rejects sourceAnonymousId with an invalid proof", async () => {
            const ctx = makeOrchestrator();
            ctx.identityProofService.verify.mockResolvedValue({
                valid: false,
                reason: "bad_signature",
            });

            await expect(
                ctx.orchestrator.initiateMerge({
                    merchantId: MERCHANT_ID,
                    sourceAnonymousId: "some-id",
                    proof: "bogus-proof",
                })
            ).rejects.toMatchObject({ code: "PROOF_INVALID", status: 403 });

            expect(ctx.identityProofService.verify).toHaveBeenCalledWith(
                expect.objectContaining({
                    op: "frak-merge-v1",
                    anonymousId: "some-id",
                    merchantId: MERCHANT_ID,
                })
            );
            expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).not.toHaveBeenCalled();
        });

        it("allows and marks proof seen for sourceAnonymousId presenting a valid proof", async () => {
            const ctx = makeOrchestrator();
            ctx.identityProofService.verify.mockResolvedValue({ valid: true });
            ctx.identityOrchestrator.resolveAndAssociate.mockResolvedValue({
                finalGroupId: "group-1",
                merged: false,
            });
            ctx.anonymousMergeService.generateToken.mockResolvedValue({
                mergeToken: MERGE_TOKEN,
                expiresAt: new Date(),
            });

            await ctx.orchestrator.initiateMerge({
                merchantId: MERCHANT_ID,
                sourceAnonymousId: "fresh-id",
                proof: "valid-proof",
            });

            expect(ctx.identityProofService.verify).toHaveBeenCalledWith(
                expect.objectContaining({
                    op: "frak-merge-v1",
                    anonymousId: "fresh-id",
                    merchantId: MERCHANT_ID,
                })
            );
            // Written exactly once, and only AFTER resolveAndAssociate: this
            // arm's node usually does not exist before that call, so an
            // earlier write would match zero rows and leave the id unlatched
            // — permanently claimable by anyone.
            expect(ctx.identityRepository.markProofSeen).toHaveBeenCalledTimes(
                1
            );
            expect(ctx.identityRepository.markProofSeen).toHaveBeenCalledWith({
                type: "anonymous_fingerprint",
                value: "fresh-id",
                merchantId: MERCHANT_ID,
            });
            expect(
                ctx.identityRepository.markProofSeen.mock.invocationCallOrder[0]
            ).toBeGreaterThan(
                ctx.identityOrchestrator.resolveAndAssociate.mock
                    .invocationCallOrder[0]
            );
            expect(
                ctx.identityOrchestrator.resolveAndAssociate
            ).toHaveBeenCalled();
        });

        it("wallet-session arm (no sourceAnonymousId, no proof) requires nothing", async () => {
            const ctx = makeOrchestrator();
            ctx.identityOrchestrator.resolveAndAssociate.mockResolvedValue({
                finalGroupId: "group-wallet",
                merged: false,
            });
            ctx.anonymousMergeService.generateToken.mockResolvedValue({
                mergeToken: MERGE_TOKEN,
                expiresAt: new Date(),
            });

            await expect(
                ctx.orchestrator.initiateMerge({
                    merchantId: MERCHANT_ID,
                    sourceWalletAddress:
                        "0x1111111111111111111111111111111111111111",
                })
            ).resolves.toMatchObject({ mergeToken: MERGE_TOKEN });

            expect(ctx.identityProofService.verify).not.toHaveBeenCalled();
            expect(
                ctx.identityRepository.findNodeByIdentity
            ).not.toHaveBeenCalled();
        });
    });

    describe("executeMerge — targetAnonymousId branch", () => {
        function setupSuccessfulExecute(
            ctx: ReturnType<typeof makeOrchestrator>
        ) {
            ctx.anonymousMergeService.validateToken.mockResolvedValue({
                sourceGroupId: "group-source",
            });
            ctx.identityRepository.findGroupByIdentity.mockResolvedValue({
                id: "group-target",
            });
            ctx.identityOrchestrator.associate.mockResolvedValue({
                finalGroupId: "group-target",
                merged: true,
            });
        }

        it("allows an unlatched legacy id as a merge target with no proof", async () => {
            const ctx = makeOrchestrator();
            setupSuccessfulExecute(ctx);
            ctx.identityRepository.findNodeByIdentity.mockResolvedValue({
                proofSeenAt: null,
            });

            const result = await ctx.orchestrator.executeMerge({
                mergeToken: MERGE_TOKEN,
                targetAnonymousId: "legacy-id",
                merchantId: MERCHANT_ID,
            });

            expect(result).toEqual({
                finalGroupId: "group-target",
                merged: true,
            });
            expect(
                ctx.identityRepository.findNodeByIdentity
            ).toHaveBeenCalledWith({
                type: "anonymous_fingerprint",
                value: "legacy-id",
                merchantId: MERCHANT_ID,
            });
        });

        it("rejects a latched target id when no proof is supplied", async () => {
            const ctx = makeOrchestrator();
            ctx.identityRepository.findNodeByIdentity.mockResolvedValue({
                proofSeenAt: new Date(),
            });

            await expect(
                ctx.orchestrator.executeMerge({
                    mergeToken: MERGE_TOKEN,
                    targetAnonymousId: "latched-id",
                    merchantId: MERCHANT_ID,
                })
            ).rejects.toMatchObject({ code: "PROOF_REQUIRED", status: 403 });

            expect(
                ctx.anonymousMergeService.validateToken
            ).not.toHaveBeenCalled();
        });

        it("rejects an invalid proof even when the id is unlatched", async () => {
            const ctx = makeOrchestrator();
            ctx.identityProofService.verify.mockResolvedValue({
                valid: false,
                reason: "expired",
            });
            ctx.identityProofService.hashMergeToken.mockReturnValue(
                new Uint8Array(32)
            );

            await expect(
                ctx.orchestrator.executeMerge({
                    mergeToken: MERGE_TOKEN,
                    targetAnonymousId: "unlatched-id",
                    merchantId: MERCHANT_ID,
                    proof: "invalid-proof",
                })
            ).rejects.toMatchObject({ code: "PROOF_INVALID", status: 403 });

            // The proof branch never reads the latch at all.
            expect(
                ctx.identityRepository.findNodeByIdentity
            ).not.toHaveBeenCalled();
            expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
        });

        it("is idempotent: a repeat valid proof does not error and re-latches harmlessly", async () => {
            const ctx = makeOrchestrator();
            setupSuccessfulExecute(ctx);
            ctx.identityProofService.verify.mockResolvedValue({
                valid: true,
            });
            ctx.identityProofService.hashMergeToken.mockReturnValue(
                new Uint8Array(32)
            );

            await ctx.orchestrator.executeMerge({
                mergeToken: MERGE_TOKEN,
                targetAnonymousId: "already-latched-id",
                merchantId: MERCHANT_ID,
                proof: "valid-proof",
            });

            expect(ctx.identityRepository.markProofSeen).toHaveBeenCalledWith({
                type: "anonymous_fingerprint",
                value: "already-latched-id",
                merchantId: MERCHANT_ID,
            });
        });

        it("proven path adds no query: the node lookup is not called when a valid proof is present", async () => {
            const ctx = makeOrchestrator();
            setupSuccessfulExecute(ctx);
            ctx.identityProofService.verify.mockResolvedValue({
                valid: true,
            });
            ctx.identityProofService.hashMergeToken.mockReturnValue(
                new Uint8Array(32)
            );

            await ctx.orchestrator.executeMerge({
                mergeToken: MERGE_TOKEN,
                targetAnonymousId: "proven-id",
                merchantId: MERCHANT_ID,
                proof: "valid-proof",
            });

            expect(
                ctx.identityRepository.findNodeByIdentity
            ).not.toHaveBeenCalled();
        });

        it("binds the proof to this merge token, not an empty binding", async () => {
            // Pairs with IdentityProofService's binding-mismatch test: that
            // one proves a wrong binding fails verification, this one proves
            // executeMerge actually feeds the token hash in. Wiring an empty
            // binding here would silently defeat this check while every
            // other test kept passing.
            const ctx = makeOrchestrator();
            setupSuccessfulExecute(ctx);
            ctx.identityProofService.verify.mockResolvedValue({ valid: true });
            const tokenHash = new Uint8Array(32).fill(7);
            ctx.identityProofService.hashMergeToken.mockReturnValue(tokenHash);

            await ctx.orchestrator.executeMerge({
                mergeToken: MERGE_TOKEN,
                targetAnonymousId: "proven-id",
                merchantId: MERCHANT_ID,
                proof: "valid-proof",
            });

            expect(
                ctx.identityProofService.hashMergeToken
            ).toHaveBeenCalledWith(MERGE_TOKEN);
            expect(ctx.identityProofService.verify).toHaveBeenCalledWith(
                expect.objectContaining({
                    op: "frak-merge-v1",
                    anonymousId: "proven-id",
                    binding: tokenHash,
                })
            );
        });
    });
});

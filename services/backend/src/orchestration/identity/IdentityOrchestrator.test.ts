import goldenProofs from "@frak-labs/core-sdk/identity/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityNode } from "./types";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
}));

vi.mock("../../infrastructure/telemetry", () => ({
    infraMetrics: { identityProofChecked: vi.fn() },
}));

const WALLET = "0x1111111111111111111111111111111111111111" as const;
const VICTIM_MERCHANT = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const VICTIM_GROUP = "victim-group";
const ATTACKER_GROUP = "attacker-group";

function makeOrchestrator() {
    const identityRepository = {
        findGroupByIdentity: vi.fn(),
        createGroup: vi.fn(),
        addNode: vi.fn(),
        deleteGroup: vi.fn(),
        invalidateCachesForGroup: vi.fn(),
        markProofSeen: vi.fn(),
    };
    const weightService = {
        getGroupWeight: vi.fn(),
        determineAnchor: vi.fn(),
        determineAnchorFromMultiple: vi.fn(),
        invalidateWeight: vi.fn(),
    };
    const mergeService = { mergeGroups: vi.fn() };
    const identityProofService = { verify: vi.fn() };

    const orchestrator = new IdentityOrchestrator(
        identityRepository as never,
        weightService as never,
        mergeService as never,
        identityProofService as never
    );

    return {
        orchestrator,
        identityRepository,
        weightService,
        mergeService,
        identityProofService,
    };
}

describe("IdentityOrchestrator.resolveForAttribution", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("throws when given no nodes", async () => {
        await expect(
            ctx.orchestrator.resolveForAttribution([])
        ).rejects.toThrow("At least one identity node is required");
    });

    it("anchors on the wallet node and never calls mergeGroups or associate weighting", async () => {
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ type }: { type: string }) =>
                type === "wallet" ? { id: ATTACKER_GROUP } : null
        );

        const nodes: IdentityNode[] = [
            {
                type: "anonymous_fingerprint",
                value: "victim-anon-id",
                merchantId: VICTIM_MERCHANT,
            },
            { type: "wallet", value: WALLET },
        ];

        const result = await ctx.orchestrator.resolveForAttribution(nodes);

        expect(result).toEqual({ groupId: ATTACKER_GROUP });
        // Only the wallet node was resolved — the anonymous fingerprint node
        // (a stranger's, forged via a header) was never looked up or created.
        expect(
            ctx.identityRepository.findGroupByIdentity
        ).toHaveBeenCalledTimes(1);
        expect(ctx.identityRepository.findGroupByIdentity).toHaveBeenCalledWith(
            expect.objectContaining({ type: "wallet", value: WALLET })
        );
        expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
        expect(ctx.weightService.getGroupWeight).not.toHaveBeenCalled();
        expect(ctx.weightService.determineAnchor).not.toHaveBeenCalled();
        expect(
            ctx.weightService.determineAnchorFromMultiple
        ).not.toHaveBeenCalled();
    });

    it("a forged x-frak-client-id cannot move a victim's group: attribution stays on the caller's own anchor", async () => {
        // Simulates POST /user/track/interaction with a foreign clientId
        // (the victim's, harvested from a share link) and the attacker's own
        // valid wallet JWT. The victim's group must never be touched.
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ type }: { type: string }) =>
                type === "wallet"
                    ? { id: ATTACKER_GROUP }
                    : { id: VICTIM_GROUP }
        );

        const forgedNodes: IdentityNode[] = [
            {
                type: "anonymous_fingerprint",
                value: "victim-anon-id",
                merchantId: VICTIM_MERCHANT,
            },
            { type: "wallet", value: WALLET },
        ];

        const result =
            await ctx.orchestrator.resolveForAttribution(forgedNodes);

        // Attribution lands on the attacker's own (authenticated) group —
        // never the victim's — and no merge/associate ever runs.
        expect(result.groupId).toBe(ATTACKER_GROUP);
        expect(result.groupId).not.toBe(VICTIM_GROUP);
        expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
    });

    it("falls back to the first node when no wallet node is present", async () => {
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue(null);
        ctx.identityRepository.createGroup.mockResolvedValue({
            id: "new-group",
        });
        ctx.identityRepository.addNode.mockResolvedValue({
            groupId: "new-group",
        });

        const nodes: IdentityNode[] = [
            {
                type: "anonymous_fingerprint",
                value: "brand-new-visitor",
                merchantId: VICTIM_MERCHANT,
            },
        ];

        const result = await ctx.orchestrator.resolveForAttribution(nodes);

        // A brand-new anonymous visitor still gets a group created — resolve
        // still creates, it just never reassigns an existing one.
        expect(result).toEqual({ groupId: "new-group" });
        expect(ctx.identityRepository.createGroup).toHaveBeenCalledTimes(1);
    });
});

/**
 * `linkWalletToFingerprint` — the login/register auth-route glue. The
 * `anonymous_fingerprint` merge it can trigger is gated on a `frak-sso-v1`
 * proof because `clientId` arrives via the UNVERIFIED `x-frak-client-id`
 * header, forgeable through SSO's unsigned `cId` field. The gate is
 * OPPORTUNISTIC, never fatal: an absent or invalid proof only skips the
 * merge, login/register still succeed.
 */
describe("IdentityOrchestrator.linkWalletToFingerprint — frak-sso-v1 gated merge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("absent proof: no merge is attempted, and the call still resolves (login/register succeed)", async () => {
        const ctx = makeOrchestrator();
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue({
            id: "wallet-group",
        });

        await expect(
            ctx.orchestrator.linkWalletToFingerprint({
                walletAddress: WALLET,
                clientId: "some-anon-id",
                merchantId: VICTIM_MERCHANT,
            })
        ).resolves.toBeUndefined();

        expect(ctx.identityProofService.verify).not.toHaveBeenCalled();
        // Only the wallet node was ever resolved — no fingerprint node built.
        expect(
            ctx.identityRepository.findGroupByIdentity
        ).toHaveBeenCalledTimes(1);
        expect(ctx.identityRepository.findGroupByIdentity).toHaveBeenCalledWith(
            expect.objectContaining({ type: "wallet" })
        );
        expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
        expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
    });

    it("invalid/forged proof: no merge, and the call still resolves (never fatal)", async () => {
        const ctx = makeOrchestrator();
        ctx.identityProofService.verify.mockResolvedValue({
            valid: false,
            reason: "bad_signature",
        });
        ctx.identityRepository.findGroupByIdentity.mockResolvedValue({
            id: "wallet-group",
        });

        await expect(
            ctx.orchestrator.linkWalletToFingerprint({
                walletAddress: WALLET,
                clientId: "victim-anon-id",
                merchantId: VICTIM_MERCHANT,
                proof: "forged-proof",
            })
        ).resolves.toBeUndefined();

        expect(ctx.identityProofService.verify).toHaveBeenCalledWith({
            op: "frak-sso-v1",
            proof: "forged-proof",
            merchantId: VICTIM_MERCHANT,
            anonymousId: "victim-anon-id",
            binding: new Uint8Array(0),
        });
        // Rejected proof ⇒ resolveAndAssociate is never given the fingerprint
        // node — only the wallet node is resolved.
        expect(
            ctx.identityRepository.findGroupByIdentity
        ).toHaveBeenCalledTimes(1);
        expect(ctx.identityRepository.findGroupByIdentity).toHaveBeenCalledWith(
            expect.objectContaining({ type: "wallet" })
        );
        expect(ctx.mergeService.mergeGroups).not.toHaveBeenCalled();
        // 🔴 markProofSeen never clears — latching an id that failed
        // verification would permanently lock it out of ever proving itself.
        expect(ctx.identityRepository.markProofSeen).not.toHaveBeenCalled();
    });

    it("valid proof: builds the anonymous_fingerprint node, merges both groups, and latches the id", async () => {
        const ctx = makeOrchestrator();
        ctx.identityProofService.verify.mockResolvedValue({ valid: true });
        ctx.identityRepository.findGroupByIdentity.mockImplementation(
            async ({ type }: { type: string }) =>
                type === "wallet"
                    ? { id: "wallet-group" }
                    : { id: "anon-group" }
        );
        ctx.weightService.getGroupWeight.mockResolvedValue({});
        ctx.weightService.determineAnchorFromMultiple.mockReturnValue({
            anchorGroupId: "wallet-group",
            mergingGroupIds: ["anon-group"],
        });

        await expect(
            ctx.orchestrator.linkWalletToFingerprint({
                walletAddress: WALLET,
                clientId: "victim-anon-id",
                merchantId: VICTIM_MERCHANT,
                proof: "valid-proof",
            })
        ).resolves.toBeUndefined();

        expect(ctx.identityProofService.verify).toHaveBeenCalledWith({
            op: "frak-sso-v1",
            proof: "valid-proof",
            merchantId: VICTIM_MERCHANT,
            anonymousId: "victim-anon-id",
            binding: new Uint8Array(0),
        });
        // Both nodes were resolved — the wallet AND the anonymous fingerprint.
        expect(
            ctx.identityRepository.findGroupByIdentity
        ).toHaveBeenCalledTimes(2);
        expect(ctx.mergeService.mergeGroups).toHaveBeenCalledWith({
            anchorGroupId: "wallet-group",
            mergingGroupIds: ["anon-group"],
        });
        expect(ctx.identityRepository.markProofSeen).toHaveBeenCalledWith({
            type: "anonymous_fingerprint",
            value: "victim-anon-id",
            merchantId: VICTIM_MERCHANT,
        });
    });

    it("real golden-fixture frak-sso-v1 proof (actual crypto, not mocked): the product capability survives", async () => {
        // Uses the REAL IdentityProofService against the golden fixture,
        // rather than a mocked `.verify` — this is the one test in the file
        // that proves the wiring (op name, empty binding,
        // anonymousId=clientId) actually matches what the SDK signs, not
        // just what this file's mocks assume it does.
        const fixture = goldenProofs.fixtures.find(
            (f) => f.op === "frak-sso-v1"
        );
        if (!fixture) {
            throw new Error("fixture set must cover frak-sso-v1");
        }
        vi.setSystemTime(fixture.ts * 1000);

        const identityRepository = {
            findGroupByIdentity: vi
                .fn()
                .mockImplementation(async ({ type }: { type: string }) =>
                    type === "wallet"
                        ? { id: "wallet-group" }
                        : { id: "anon-group" }
                ),
            invalidateCachesForGroup: vi.fn(),
            markProofSeen: vi.fn(),
        };
        const weightService = {
            getGroupWeight: vi.fn().mockResolvedValue({}),
            determineAnchorFromMultiple: vi.fn().mockReturnValue({
                anchorGroupId: "wallet-group",
                mergingGroupIds: ["anon-group"],
            }),
            invalidateWeight: vi.fn(),
        };
        const mergeService = {
            mergeGroups: vi.fn().mockResolvedValue(undefined),
        };

        const orchestrator = new IdentityOrchestrator(
            identityRepository as never,
            weightService as never,
            mergeService as never,
            new IdentityProofService()
        );

        await orchestrator.linkWalletToFingerprint({
            walletAddress: WALLET,
            clientId: fixture.anonymousId,
            merchantId: fixture.merchantId,
            proof: fixture.proof,
        });

        expect(mergeService.mergeGroups).toHaveBeenCalledWith({
            anchorGroupId: "wallet-group",
            mergingGroupIds: ["anon-group"],
        });
        expect(identityRepository.markProofSeen).toHaveBeenCalledWith({
            type: "anonymous_fingerprint",
            value: fixture.anonymousId,
            merchantId: fixture.merchantId,
        });

        vi.useRealTimers();
    });
});

describe("IdentityOrchestrator merge cache invalidation", () => {
    let ctx: ReturnType<typeof makeOrchestrator>;

    beforeEach(() => {
        ctx = makeOrchestrator();
    });

    it("associate invalidates the anchor's weight too, not just the loser's", async () => {
        // The anchor absorbs the loser's assets, referrals and interactions, so
        // its own cached weight is understated afterwards. Leaving it cached
        // would feed stale counts to a follow-up merge's tie-break for the rest
        // of the TTL.
        ctx.weightService.getGroupWeight.mockImplementation(
            async (groupId: string) => ({ groupId, wallet: null })
        );
        ctx.weightService.determineAnchor.mockReturnValue({
            anchorGroupId: "anchor",
            mergingGroupId: "loser",
        });

        const result = await ctx.orchestrator.associate("anchor", "loser");

        expect(result).toEqual({ finalGroupId: "anchor", merged: true });
        expect(ctx.weightService.invalidateWeight).toHaveBeenCalledWith(
            "anchor"
        );
        expect(ctx.weightService.invalidateWeight).toHaveBeenCalledWith(
            "loser"
        );
    });

    it("resolveAndAssociate invalidates the anchor's weight too", async () => {
        ctx.identityRepository.findGroupByIdentity
            .mockResolvedValueOnce({ id: "anchor" })
            .mockResolvedValueOnce({ id: "loser" });
        ctx.weightService.getGroupWeight.mockImplementation(
            async (groupId: string) => ({ groupId, wallet: null })
        );
        ctx.weightService.determineAnchorFromMultiple.mockReturnValue({
            anchorGroupId: "anchor",
            mergingGroupIds: ["loser"],
        });

        const nodes: IdentityNode[] = [
            { type: "wallet", value: WALLET },
            {
                type: "anonymous_fingerprint",
                value: "anon-1",
                merchantId: VICTIM_MERCHANT,
            },
        ];
        const result = await ctx.orchestrator.resolveAndAssociate(nodes);

        expect(result).toEqual({ finalGroupId: "anchor", merged: true });
        expect(ctx.weightService.invalidateWeight).toHaveBeenCalledWith(
            "anchor"
        );
        expect(ctx.weightService.invalidateWeight).toHaveBeenCalledWith(
            "loser"
        );
    });
});

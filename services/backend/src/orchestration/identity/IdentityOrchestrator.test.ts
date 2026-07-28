import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityOrchestrator } from "./IdentityOrchestrator";
import type { IdentityNode } from "./types";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    db: { transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({})) },
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
    };
    const weightService = {
        getGroupWeight: vi.fn(),
        determineAnchor: vi.fn(),
        determineAnchorFromMultiple: vi.fn(),
        invalidateWeight: vi.fn(),
    };
    const mergeService = { mergeGroups: vi.fn() };

    const orchestrator = new IdentityOrchestrator(
        identityRepository as never,
        weightService as never,
        mergeService as never
    );

    return { orchestrator, identityRepository, weightService, mergeService };
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
        // valid wallet JWT — the single-request variant of the headline
        // attack (README §1). The victim's group must never be touched.
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

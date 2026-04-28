import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferralLinkRepository } from "./ReferralLinkRepository";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

/**
 * Mock the DB layer. db.execute returns T[] directly with postgres-js.
 * vi.hoisted ensures mockExecute is available when vi.mock is hoisted.
 */
const { mockExecute, mockReturning } = vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockReturning: vi.fn(),
}));

vi.mock("../../../infrastructure/persistence/postgres", () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: mockReturning,
        execute: mockExecute,
    },
}));

describe("ReferralLinkRepository", () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        mockExecute.mockReset();
        mockReturning.mockReset();
        mockReturning.mockResolvedValue([]);
    });

    const merchantId = "merchant-1";
    const groupA = "group-a";
    const groupB = "group-b";
    const groupC = "group-c";

    describe("findChain (recursive CTE)", () => {
        it("should return chain from CTE results", async () => {
            const repository = new ReferralLinkRepository();

            // Simulate CTE returning a 2-level chain: A→B→C
            mockExecute.mockResolvedValue([
                { identity_group_id: groupB, depth: 1 },
                { identity_group_id: groupC, depth: 2 },
            ]);

            const chain = await repository.findChain(merchantId, groupA, 5);

            expect(chain).toEqual([
                { identityGroupId: groupB, depth: 1 },
                { identityGroupId: groupC, depth: 2 },
            ]);
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it("should return empty chain when no referrer exists", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([]);

            const chain = await repository.findChain(merchantId, groupA, 5);

            expect(chain).toEqual([]);
        });

        it("caches chain results across calls with same key", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([
                { identity_group_id: groupB, depth: 1 },
            ]);

            await repository.findChain(merchantId, groupA, 5);
            await repository.findChain(merchantId, groupA, 5);

            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it("does not share cache across different maxDepth", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute
                .mockResolvedValueOnce([
                    { identity_group_id: groupB, depth: 1 },
                ])
                .mockResolvedValueOnce([
                    { identity_group_id: groupB, depth: 1 },
                    { identity_group_id: groupC, depth: 2 },
                ]);

            const chain1 = await repository.findChain(merchantId, groupA, 1);
            const chain2 = await repository.findChain(merchantId, groupA, 5);

            expect(chain1).toHaveLength(1);
            expect(chain2).toHaveLength(2);
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });
    });

    describe("wouldCreateCycle (recursive CTE)", () => {
        it("should detect direct cycle (B→A exists, proposed A→B)", async () => {
            const repository = new ReferralLinkRepository();

            // CTE returns would_cycle = true
            mockExecute.mockResolvedValue([{ would_cycle: true }]);

            const result = await repository.wouldCreateCycle(
                groupA, // referrer
                groupB // referee
            );

            expect(result).toBe(true);
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it("should detect indirect cycle (A→B→C exists, proposed C→A)", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([{ would_cycle: true }]);

            const result = await repository.wouldCreateCycle(
                groupC, // referrer
                groupA // referee
            );

            expect(result).toBe(true);
        });

        it("should allow valid chain (no cycle)", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([{ would_cycle: false }]);

            const result = await repository.wouldCreateCycle(groupA, groupC);

            expect(result).toBe(false);
        });

        it("should allow when referrer has no chain", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([{ would_cycle: false }]);

            const result = await repository.wouldCreateCycle(groupA, groupB);

            expect(result).toBe(false);
        });

        it("should default to false on empty result", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([]);

            const result = await repository.wouldCreateCycle(groupA, groupB);

            expect(result).toBe(false);
        });

        it("should not use cache (needs fresh data for write path)", async () => {
            const repository = new ReferralLinkRepository();

            mockExecute.mockResolvedValue([{ would_cycle: false }]);

            // Two calls should both hit DB
            await repository.wouldCreateCycle(groupA, groupB);
            await repository.wouldCreateCycle(groupA, groupB);

            expect(mockExecute).toHaveBeenCalledTimes(2);
        });
    });

    describe("removeReferrer", () => {
        it("returns the soft-deleted row on success", async () => {
            const repository = new ReferralLinkRepository();
            const removedRow = {
                id: "link-1",
                scope: "cross_merchant",
                merchantId: null,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
                source: "code",
                sourceData: null,
                createdAt: new Date(),
                removedAt: new Date(),
                endReason: "removed",
            };
            mockReturning.mockResolvedValueOnce([removedRow]);

            const result = await repository.removeReferrer({
                merchantId: null,
                refereeIdentityGroupId: groupB,
                scope: "cross_merchant",
                reason: "removed",
            });

            expect(result).toEqual(removedRow);
        });

        it("clears the chain cache on successful removal", async () => {
            const repository = new ReferralLinkRepository();
            // Prime the chain cache.
            mockExecute.mockResolvedValue([
                { identity_group_id: groupB, depth: 1 },
            ]);
            await repository.findChain(merchantId, groupA, 5);
            expect(mockExecute).toHaveBeenCalledTimes(1);

            // Soft-delete a row — cache must drop.
            mockReturning.mockResolvedValueOnce([{ id: "link-1" }]);
            await repository.removeReferrer({
                merchantId: null,
                refereeIdentityGroupId: groupB,
                scope: "cross_merchant",
                reason: "removed",
            });

            // Same findChain call should re-hit DB.
            await repository.findChain(merchantId, groupA, 5);
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });

        it("does NOT clear the chain cache when no row was removed", async () => {
            const repository = new ReferralLinkRepository();
            mockExecute.mockResolvedValue([
                { identity_group_id: groupB, depth: 1 },
            ]);
            await repository.findChain(merchantId, groupA, 5);
            expect(mockExecute).toHaveBeenCalledTimes(1);

            // No active row — returning [] from db.update.
            mockReturning.mockResolvedValueOnce([]);
            await repository.removeReferrer({
                merchantId: null,
                refereeIdentityGroupId: groupB,
                scope: "cross_merchant",
                reason: "removed",
            });

            // Cache still warm — second findChain hits cache.
            await repository.findChain(merchantId, groupA, 5);
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it("returns null when no active row to remove", async () => {
            const repository = new ReferralLinkRepository();
            mockReturning.mockResolvedValueOnce([]);

            const result = await repository.removeReferrer({
                merchantId,
                refereeIdentityGroupId: groupB,
                scope: "merchant",
                reason: "removed",
            });

            expect(result).toBeNull();
        });

        it("returns null when scope='merchant' but merchantId is null (defensive)", async () => {
            const repository = new ReferralLinkRepository();

            const result = await repository.removeReferrer({
                merchantId: null,
                refereeIdentityGroupId: groupB,
                scope: "merchant",
                reason: "removed",
            });

            expect(result).toBeNull();
            // No DB call attempted — short-circuited.
            expect(mockReturning).not.toHaveBeenCalled();
        });
    });
});

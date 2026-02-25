import { afterAll, describe, expect, it, vi } from "vitest";
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
 * Mock the DB layer — we test the cycle detection logic, not the SQL.
 */
vi.mock("../../../infrastructure/persistence/postgres", () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
    },
}));

describe("ReferralLinkRepository", () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const merchantId = "merchant-1";
    const groupA = "group-a";
    const groupB = "group-b";
    const groupC = "group-c";
    const groupD = "group-d";

    describe("findChain - cycle defense", () => {
        it("should stop traversal when a cycle is detected in existing data", async () => {
            const repository = new ReferralLinkRepository();

            // Simulate a cyclic chain: A→B→C→A
            // findByReferee(merchant, X) returns "who referred X"
            const referralMap: Record<string, string> = {
                [groupA]: groupB, // B referred A
                [groupB]: groupC, // C referred B
                [groupC]: groupA, // A referred C (cycle!)
            };

            vi.spyOn(repository, "findByReferee").mockImplementation(
                async (_merchantId, refereeId) => {
                    const referrerId = referralMap[refereeId];
                    if (!referrerId) return null;
                    return {
                        id: `link-${refereeId}`,
                        merchantId,
                        referrerIdentityGroupId: referrerId,
                        refereeIdentityGroupId: refereeId,
                        createdAt: new Date(),
                    };
                }
            );

            // Starting from A, chain should be B(1), C(2) then stop
            // because A is in the visited set (it's the start)
            const chain = await repository.findChain(merchantId, groupA, 10);

            expect(chain).toEqual([
                { identityGroupId: groupB, depth: 1 },
                { identityGroupId: groupC, depth: 2 },
            ]);
            // Should NOT include groupA again (cycle break)
            expect(
                chain.find((m) => m.identityGroupId === groupA)
            ).toBeUndefined();
        });

        it("should stop at maxDepth even without cycle", async () => {
            const repository = new ReferralLinkRepository();

            // Linear chain: A→B→C→D
            const referralMap: Record<string, string> = {
                [groupA]: groupB,
                [groupB]: groupC,
                [groupC]: groupD,
            };

            vi.spyOn(repository, "findByReferee").mockImplementation(
                async (_merchantId, refereeId) => {
                    const referrerId = referralMap[refereeId];
                    if (!referrerId) return null;
                    return {
                        id: `link-${refereeId}`,
                        merchantId,
                        referrerIdentityGroupId: referrerId,
                        refereeIdentityGroupId: refereeId,
                        createdAt: new Date(),
                    };
                }
            );

            const chain = await repository.findChain(merchantId, groupA, 2);

            expect(chain).toHaveLength(2);
            expect(chain[0]).toEqual({
                identityGroupId: groupB,
                depth: 1,
            });
            expect(chain[1]).toEqual({
                identityGroupId: groupC,
                depth: 2,
            });
        });
    });

    describe("wouldCreateCycle", () => {
        it("should detect direct cycle (A→B, proposed B→A)", async () => {
            const repository = new ReferralLinkRepository();

            // Existing: B referred A (B→A link).
            // wouldCreateCycle(merchant, A, B, 5) calls findChain(merchant, A, 5)
            // which walks A's referrer chain: A's referrer is B.
            // Chain from A = [B at depth 1].
            // Is B (the proposed referee) in A's chain? Yes → cycle!
            vi.spyOn(repository, "findChain").mockResolvedValue([
                { identityGroupId: groupB, depth: 1 },
            ]);

            const result = await repository.wouldCreateCycle(
                merchantId,
                groupA, // referrer
                groupB, // referee
                5
            );

            expect(result).toBe(true);
            expect(repository.findChain).toHaveBeenCalledWith(
                merchantId,
                groupA,
                5
            );
        });

        it("should detect indirect cycle (A→B→C, proposed C→A)", async () => {
            const repository = new ReferralLinkRepository();

            // Existing: A referred B, B referred C.
            // wouldCreateCycle(merchant, C, A, 5) calls findChain(merchant, C, 5)
            // which walks C's referrer chain: C's referrer is B, B's referrer is A.
            // Chain from C = [B at depth 1, A at depth 2].
            // Is A (the proposed referee) in C's chain? Yes → cycle!
            vi.spyOn(repository, "findChain").mockResolvedValue([
                { identityGroupId: groupB, depth: 1 },
                { identityGroupId: groupA, depth: 2 },
            ]);

            const result = await repository.wouldCreateCycle(
                merchantId,
                groupC, // referrer
                groupA, // referee
                5
            );

            expect(result).toBe(true);
        });

        it("should allow valid chain (no cycle)", async () => {
            const repository = new ReferralLinkRepository();

            // Chain from A: A's referrer is B
            vi.spyOn(repository, "findChain").mockResolvedValue([
                { identityGroupId: groupB, depth: 1 },
            ]);

            // Proposed: A refers C — C is NOT in A's chain
            const result = await repository.wouldCreateCycle(
                merchantId,
                groupA,
                groupC,
                5
            );

            expect(result).toBe(false);
        });

        it("should allow when referrer has no chain", async () => {
            const repository = new ReferralLinkRepository();

            vi.spyOn(repository, "findChain").mockResolvedValue([]);

            const result = await repository.wouldCreateCycle(
                merchantId,
                groupA,
                groupB,
                5
            );

            expect(result).toBe(false);
        });
    });
});

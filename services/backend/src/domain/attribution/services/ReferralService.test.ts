import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferralLinkRepository } from "../repositories/ReferralLinkRepository";
import { ReferralService } from "./ReferralService";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe("ReferralService", () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const createMockRepository = () =>
        ({
            findByReferee: vi.fn(),
            create: vi.fn(),
            findChain: vi.fn(),
            wouldCreateCycle: vi.fn(),
        }) as unknown as ReferralLinkRepository & {
            findByReferee: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
            findChain: ReturnType<typeof vi.fn>;
            wouldCreateCycle: ReturnType<typeof vi.fn>;
        };

    const merchantId = "merchant-1";
    const groupA = "group-a";
    const groupB = "group-b";
    const groupC = "group-c";

    let repository: ReturnType<typeof createMockRepository>;
    let service: ReferralService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new ReferralService(
            repository as unknown as ReferralLinkRepository
        );
    });

    describe("registerReferral", () => {
        it("should block self-referral", async () => {
            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupA,
            });

            expect(result.registered).toBe(false);
            expect(repository.findByReferee).not.toHaveBeenCalled();
        });

        it("should block when referee already has a referrer", async () => {
            repository.findByReferee.mockResolvedValue({
                id: "existing-link",
                scope: "merchant",
                merchantId,
                referrerIdentityGroupId: groupB,
                refereeIdentityGroupId: groupC,
                source: "link",
            });

            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupC,
            });

            expect(result.registered).toBe(false);
            if (!result.registered) {
                expect(result.existingReferrer).toBe(groupB);
            }
        });

        it("should block when link would create a direct cycle (A→B→A)", async () => {
            repository.findByReferee.mockResolvedValue(null);
            repository.wouldCreateCycle.mockResolvedValue(true);

            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
            });

            expect(result.registered).toBe(false);
            expect(repository.wouldCreateCycle).toHaveBeenCalledWith(
                groupA,
                groupB
            );
            expect(repository.create).not.toHaveBeenCalled();
        });

        it("should block when link would create an indirect cycle (A→B→C→A)", async () => {
            repository.findByReferee.mockResolvedValue(null);
            repository.wouldCreateCycle.mockResolvedValue(true);

            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupC,
                refereeIdentityGroupId: groupA,
            });

            expect(result.registered).toBe(false);
            expect(repository.create).not.toHaveBeenCalled();
        });

        it("should register when no cycle detected", async () => {
            repository.findByReferee.mockResolvedValue(null);
            repository.wouldCreateCycle.mockResolvedValue(false);
            repository.create.mockResolvedValue({
                id: "new-link",
                scope: "merchant",
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
                source: "link",
            });

            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
                sourceData: { type: "link", sharedAt: 1709654400 },
            });

            expect(result.registered).toBe(true);
            expect(repository.create).toHaveBeenCalledWith({
                scope: "merchant",
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
                source: "link",
                sourceData: { type: "link", sharedAt: 1709654400 },
            });
        });

        it("should return false when repository create fails", async () => {
            repository.findByReferee.mockResolvedValue(null);
            repository.wouldCreateCycle.mockResolvedValue(false);
            repository.create.mockResolvedValue(null);

            const result = await service.registerReferral({
                merchantId,
                referrerIdentityGroupId: groupA,
                refereeIdentityGroupId: groupB,
            });

            expect(result.registered).toBe(false);
        });
    });

    describe("getReferralChain", () => {
        it("should return chain from repository with default max depth", async () => {
            const expectedChain = [
                { identityGroupId: groupA, depth: 1 },
                { identityGroupId: groupB, depth: 2 },
            ];
            repository.findChain.mockResolvedValue(expectedChain);

            const result = await service.getReferralChain({
                merchantId,
                identityGroupId: groupC,
            });

            expect(result).toEqual(expectedChain);
            expect(repository.findChain).toHaveBeenCalledWith(
                merchantId,
                groupC,
                5
            );
        });

        it("should pass custom max depth", async () => {
            repository.findChain.mockResolvedValue([]);

            await service.getReferralChain({
                merchantId,
                identityGroupId: groupC,
                maxDepth: 3,
            });

            expect(repository.findChain).toHaveBeenCalledWith(
                merchantId,
                groupC,
                3
            );
        });
    });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferralCodeRepository } from "../repositories/ReferralCodeRepository";
import { ReferralCodeService } from "./ReferralCodeService";

vi.mock("@backend-infrastructure", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("ReferralCodeService.suggestWithStem", () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const createMockRepository = () =>
        ({
            filterAvailableCandidates: vi.fn(),
            findActiveByOwner: vi.fn(),
            findByCode: vi.fn(),
            create: vi.fn(),
            revokeActiveByOwner: vi.fn(),
            deleteExpiredRevoked: vi.fn(),
        }) as unknown as ReferralCodeRepository & {
            filterAvailableCandidates: ReturnType<typeof vi.fn>;
        };

    let repository: ReturnType<typeof createMockRepository>;
    let service: ReferralCodeService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new ReferralCodeService(
            repository as unknown as ReferralCodeRepository
        );
    });

    it("rejects stems shorter than 3 chars", async () => {
        const result = await service.suggestWithStem({ stem: "QU" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_STEM_LENGTH");
        }
        expect(repository.filterAvailableCandidates).not.toHaveBeenCalled();
    });

    it("rejects stems longer than 4 chars", async () => {
        const result = await service.suggestWithStem({ stem: "QUENTI" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_STEM_LENGTH");
        }
    });

    it("rejects stems with ambiguous chars removed from the alphabet (O)", async () => {
        const result = await service.suggestWithStem({ stem: "QUO" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_STEM_CHARS");
        }
    });

    it("rejects stems with ambiguous chars removed from the alphabet (1)", async () => {
        const result = await service.suggestWithStem({ stem: "QU1" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_STEM_CHARS");
        }
    });

    it("uppercases the stem before generating candidates", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates.slice(0, 5)
        );

        const result = await service.suggestWithStem({
            stem: "quen",
            count: 5,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            for (const suggestion of result.suggestions) {
                expect(suggestion).toContain("QUEN");
                expect(suggestion).toHaveLength(6);
            }
        }
    });

    it("prefers digit-filled candidates when all are available", async () => {
        // Return the pool unchanged (everything is "available").
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const result = await service.suggestWithStem({
            stem: "QUEN",
            count: 10,
        });
        expect(result.success).toBe(true);
        if (!result.success) return;

        const digitsOnly = /^[23456789]+$/;

        // First suggestions in the ordered array should be digit-filled
        // (preference semantics). Each 6-char candidate has either a 2-char
        // prefix or 2-char suffix of pure digits surrounding the QUEN stem.
        const firstFive = result.suggestions.slice(0, 5);
        for (const suggestion of firstFive) {
            expect(suggestion).toContain("QUEN");
            const fill = suggestion.replace("QUEN", "");
            expect(fill).toMatch(digitsOnly);
        }
    });

    it("falls back to letter-filled candidates when the digit pool is exhausted", async () => {
        // Pretend every digit-only candidate is taken, but letter-containing
        // candidates remain available.
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) =>
                candidates.filter((c) => {
                    const fill = c.replace("QUEN", "");
                    return /[A-Z]/.test(fill);
                })
        );

        const result = await service.suggestWithStem({
            stem: "QUEN",
            count: 5,
        });
        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.suggestions.length).toBeGreaterThan(0);
        for (const suggestion of result.suggestions) {
            const fill = suggestion.replace("QUEN", "");
            expect(fill).toMatch(/[A-Z]/);
        }
    });

    it("caps count at the hard ceiling (20)", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const result = await service.suggestWithStem({
            stem: "QUE",
            count: 999,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.suggestions.length).toBeLessThanOrEqual(20);
        }
    });

    it("defaults count to 10 when omitted", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const result = await service.suggestWithStem({ stem: "QUE" });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.suggestions.length).toBeLessThanOrEqual(10);
            expect(result.suggestions.length).toBeGreaterThan(0);
        }
    });

    it("places fill characters only at the start or end of the stem", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const result = await service.suggestWithStem({
            stem: "QUE",
            count: 15,
        });
        expect(result.success).toBe(true);
        if (!result.success) return;

        for (const suggestion of result.suggestions) {
            // The stem must sit at index 0 (suffix fill) or at index fillLen
            // (prefix fill) — never in the middle.
            const stemStart = suggestion.indexOf("QUE");
            expect(stemStart === 0 || stemStart === 3).toBe(true);
        }
    });
});

describe("ReferralCodeService.issue", () => {
    afterAll(() => {
        vi.restoreAllMocks();
    });

    const createMockRepository = () =>
        ({
            filterAvailableCandidates: vi.fn(),
            findActiveByOwner: vi.fn(),
            findByCode: vi.fn(),
            create: vi.fn(),
            revokeActiveByOwner: vi.fn(),
            deleteExpiredRevoked: vi.fn(),
        }) as unknown as ReferralCodeRepository & {
            findActiveByOwner: ReturnType<typeof vi.fn>;
            create: ReturnType<typeof vi.fn>;
        };

    const ownerIdentityGroupId = "owner-1";

    let repository: ReturnType<typeof createMockRepository>;
    let service: ReferralCodeService;

    beforeEach(() => {
        repository = createMockRepository();
        service = new ReferralCodeService(
            repository as unknown as ReferralCodeRepository
        );
    });

    it("returns ALREADY_ACTIVE when the owner already has an active code", async () => {
        repository.findActiveByOwner.mockResolvedValue({
            id: "code-1",
            code: "AAAAAA",
            ownerIdentityGroupId,
            createdAt: new Date(),
            revokedAt: null,
        });

        const result = await service.issue({ ownerIdentityGroupId });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("ALREADY_ACTIVE");
        }
        expect(repository.create).not.toHaveBeenCalled();
    });

    it("issues a random code when preferredCode is omitted", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue({
            id: "code-1",
            code: "R4ND0M",
            ownerIdentityGroupId,
            createdAt: new Date(),
            revokedAt: null,
        });

        const result = await service.issue({ ownerIdentityGroupId });
        expect(result.success).toBe(true);
        // No candidates argument — repo falls back to generateCandidates().
        expect(repository.create).toHaveBeenCalledWith({
            ownerIdentityGroupId,
            candidates: undefined,
        });
    });

    it("claims a preferredCode when available", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue({
            id: "code-1",
            code: "QUEN42",
            ownerIdentityGroupId,
            createdAt: new Date(),
            revokedAt: null,
        });

        const result = await service.issue({
            ownerIdentityGroupId,
            preferredCode: "QUEN42",
        });
        expect(result.success).toBe(true);
        expect(repository.create).toHaveBeenCalledWith({
            ownerIdentityGroupId,
            candidates: ["QUEN42"],
        });
    });

    it("uppercases a lowercase preferredCode", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue({
            id: "code-1",
            code: "QUEN42",
            ownerIdentityGroupId,
            createdAt: new Date(),
            revokedAt: null,
        });

        await service.issue({
            ownerIdentityGroupId,
            preferredCode: "quen42",
        });
        expect(repository.create).toHaveBeenCalledWith({
            ownerIdentityGroupId,
            candidates: ["QUEN42"],
        });
    });

    it("returns CODE_UNAVAILABLE when preferredCode collides", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue(null);

        const result = await service.issue({
            ownerIdentityGroupId,
            preferredCode: "QUEN42",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("CODE_UNAVAILABLE");
        }
    });

    it("throws when random issue exhausts the candidate batch (unreachable branch)", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue(null);

        await expect(service.issue({ ownerIdentityGroupId })).rejects.toThrow(
            /Failed to issue referral code/
        );
    });

    it("rejects preferredCode with wrong length", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);

        const result = await service.issue({
            ownerIdentityGroupId,
            preferredCode: "QUEN",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_CODE_LENGTH");
        }
        expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects preferredCode containing ambiguous chars", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);

        const result = await service.issue({
            ownerIdentityGroupId,
            preferredCode: "QUEN4O", // O is not in the alphabet
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.code).toBe("INVALID_CODE_CHARS");
        }
        expect(repository.create).not.toHaveBeenCalled();
    });
});

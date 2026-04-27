import { HttpError } from "@backend-utils";
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
        await expect(
            service.suggestWithStem({ stem: "QU" })
        ).rejects.toMatchObject({
            code: "INVALID_STEM_LENGTH",
            status: 400,
        });
        expect(repository.filterAvailableCandidates).not.toHaveBeenCalled();
    });

    it("rejects stems longer than 4 chars", async () => {
        await expect(
            service.suggestWithStem({ stem: "QUENTI" })
        ).rejects.toMatchObject({ code: "INVALID_STEM_LENGTH" });
    });

    it("rejects stems with ambiguous chars removed from the alphabet (O)", async () => {
        await expect(
            service.suggestWithStem({ stem: "QUO" })
        ).rejects.toMatchObject({ code: "INVALID_STEM_CHARS" });
    });

    it("rejects stems with ambiguous chars removed from the alphabet (1)", async () => {
        await expect(
            service.suggestWithStem({ stem: "QU1" })
        ).rejects.toMatchObject({ code: "INVALID_STEM_CHARS" });
    });

    it("uppercases the stem before generating candidates", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates.slice(0, 5)
        );

        const suggestions = await service.suggestWithStem({
            stem: "quen",
            count: 5,
        });
        for (const suggestion of suggestions) {
            expect(suggestion).toContain("QUEN");
            expect(suggestion).toHaveLength(6);
        }
    });

    it("prefers digit-filled candidates when all are available", async () => {
        // Return the pool unchanged (everything is "available").
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const suggestions = await service.suggestWithStem({
            stem: "QUEN",
            count: 10,
        });

        const digitsOnly = /^[23456789]+$/;

        // First suggestions in the ordered array should be digit-filled
        // (preference semantics). Each 6-char candidate has either a 2-char
        // prefix or 2-char suffix of pure digits surrounding the QUEN stem.
        const firstFive = suggestions.slice(0, 5);
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

        const suggestions = await service.suggestWithStem({
            stem: "QUEN",
            count: 5,
        });

        expect(suggestions.length).toBeGreaterThan(0);
        for (const suggestion of suggestions) {
            const fill = suggestion.replace("QUEN", "");
            expect(fill).toMatch(/[A-Z]/);
        }
    });

    it("caps count at the hard ceiling (20)", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const suggestions = await service.suggestWithStem({
            stem: "QUE",
            count: 999,
        });
        expect(suggestions.length).toBeLessThanOrEqual(20);
    });

    it("defaults count to 10 when omitted", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const suggestions = await service.suggestWithStem({ stem: "QUE" });
        expect(suggestions.length).toBeLessThanOrEqual(10);
        expect(suggestions.length).toBeGreaterThan(0);
    });

    it("places fill characters only at the start or end of the stem", async () => {
        repository.filterAvailableCandidates.mockImplementation(
            async (candidates: string[]) => candidates
        );

        const suggestions = await service.suggestWithStem({
            stem: "QUE",
            count: 15,
        });

        for (const suggestion of suggestions) {
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

    it("throws ALREADY_ACTIVE when the owner already has an active code", async () => {
        repository.findActiveByOwner.mockResolvedValue({
            id: "code-1",
            code: "AAAAAA",
            ownerIdentityGroupId,
            createdAt: new Date(),
            revokedAt: null,
        });

        await expect(
            service.issue({ ownerIdentityGroupId })
        ).rejects.toBeInstanceOf(HttpError);
        await expect(
            service.issue({ ownerIdentityGroupId })
        ).rejects.toMatchObject({ code: "ALREADY_ACTIVE", status: 409 });
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

        const created = await service.issue({ ownerIdentityGroupId });
        expect(created.code).toBe("R4ND0M");
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

        const created = await service.issue({
            ownerIdentityGroupId,
            preferredCode: "QUEN42",
        });
        expect(created.code).toBe("QUEN42");
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

    it("throws CODE_UNAVAILABLE when preferredCode collides", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);
        repository.create.mockResolvedValue(null);

        await expect(
            service.issue({
                ownerIdentityGroupId,
                preferredCode: "QUEN42",
            })
        ).rejects.toMatchObject({ code: "CODE_UNAVAILABLE", status: 409 });
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

        await expect(
            service.issue({
                ownerIdentityGroupId,
                preferredCode: "QUEN",
            })
        ).rejects.toMatchObject({ code: "INVALID_CODE_LENGTH", status: 400 });
        expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects preferredCode containing ambiguous chars", async () => {
        repository.findActiveByOwner.mockResolvedValue(null);

        await expect(
            service.issue({
                ownerIdentityGroupId,
                preferredCode: "QUEN4O", // O is not in the alphabet
            })
        ).rejects.toMatchObject({ code: "INVALID_CODE_CHARS", status: 400 });
        expect(repository.create).not.toHaveBeenCalled();
    });
});

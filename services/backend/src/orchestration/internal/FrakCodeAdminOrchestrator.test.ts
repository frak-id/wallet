import { describe, expect, it, vi } from "vitest";
import { FRAK_REFERRAL_IDENTITY_GROUP_ID } from "../../domain/referral-code/constants";
import {
    FrakCodeAdminOrchestrator,
    parseVanityCode,
} from "./FrakCodeAdminOrchestrator";

const code = (value: string, id = `id-${value}`) => ({
    id,
    code: value,
    ownerIdentityGroupId: FRAK_REFERRAL_IDENTITY_GROUP_ID,
    kind: "frak" as const,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    revokedAt: null,
});

function makeOrchestrator(
    opts: {
        created?: (candidate: string) => ReturnType<typeof code> | null;
        revoked?: ReturnType<typeof code> | null;
    } = {}
) {
    const createFrakCode = vi.fn(async (candidate: string) =>
        opts.created ? opts.created(candidate) : code(candidate)
    );
    const ensureGroup = vi.fn();
    const orchestrator = new FrakCodeAdminOrchestrator(
        {
            createFrakCode,
            revokeFrakCode: vi.fn().mockResolvedValue(opts.revoked ?? null),
            listFrakCodes: vi
                .fn()
                .mockResolvedValue([
                    code("GAME01", "c1"),
                    code("PLAIN1", "c2"),
                ]),
        } as never,
        {
            countByCodeIds: vi
                .fn()
                .mockResolvedValue(new Map([["c2", { total: 5, active: 4 }]])),
        } as never,
        {
            list: vi
                .fn()
                .mockResolvedValue([{ id: "game-1", referralCodeId: "c1" }]),
        } as never,
        { ensureGroup } as never
    );
    return { orchestrator, createFrakCode, ensureGroup };
}

describe("parseVanityCode", () => {
    it("uppercases and trims a valid code", () => {
        expect(parseVanityCode(" frak26 ")).toBe("FRAK26");
    });

    it.each([
        { name: "too short", raw: "FRAK" },
        { name: "too long", raw: "FRAK2026" },
        { name: "outside the alphabet", raw: "FRAK!6" },
    ])("rejects a code $name", ({ raw }) => {
        expect(() => parseVanityCode(raw)).toThrow(
            expect.objectContaining({ status: 400, code: "INVALID_CODE" })
        );
    });
});

describe("FrakCodeAdminOrchestrator", () => {
    it("lists codes with their redemptions and game", async () => {
        const { orchestrator } = makeOrchestrator();
        expect(await orchestrator.list()).toEqual([
            expect.objectContaining({
                code: "GAME01",
                redemptions: 0,
                activeReferees: 0,
                gameId: "game-1",
            }),
            expect.objectContaining({
                code: "PLAIN1",
                redemptions: 5,
                activeReferees: 4,
                gameId: null,
            }),
        ]);
    });

    it("issues a vanity code on Frak's identity group", async () => {
        const { orchestrator, createFrakCode, ensureGroup } =
            makeOrchestrator();
        const issued = await orchestrator.issue("frak26");
        expect(issued.code).toBe("FRAK26");
        expect(createFrakCode).toHaveBeenCalledExactlyOnceWith("FRAK26");
        expect(ensureGroup).toHaveBeenCalledWith(
            FRAK_REFERRAL_IDENTITY_GROUP_ID
        );
    });

    it("409s a vanity code already in use", async () => {
        const { orchestrator } = makeOrchestrator({ created: () => null });
        await expect(orchestrator.issue("FRAK26")).rejects.toMatchObject({
            status: 409,
            code: "CODE_TAKEN",
        });
    });

    it("moves to the next random candidate on a collision", async () => {
        let calls = 0;
        const { orchestrator, createFrakCode } = makeOrchestrator({
            created: (candidate) => (++calls < 3 ? null : code(candidate)),
        });
        await orchestrator.issue();
        expect(createFrakCode).toHaveBeenCalledTimes(3);
    });

    it("404s revoking a code that is not active", async () => {
        const { orchestrator } = makeOrchestrator();
        await expect(orchestrator.revoke("NOPE01")).rejects.toMatchObject({
            status: 404,
            code: "CODE_NOT_FOUND",
        });
    });
});

import { beforeEach, describe, expect, it } from "vitest";
import { dbMock } from "../../../../test/mock/common";
import {
    InstallCodeRepository,
    MAX_RESOLVE_ATTEMPTS,
} from "./InstallCodeRepository";

/**
 * `findByCode` counts the attempt in the same UPDATE ... RETURNING as the
 * lookup (README §3.3), so the exhaustion check and the increment can't race
 * across concurrent guesses the way a read-then-write pair could. The global
 * `dbMock`'s `update` chain resolves whatever `__setUpdateResponse` returns
 * regardless of the `where` condition, so these tests exercise the
 * repository's row mapping and its "absent means null" contract, not the
 * generated SQL predicate itself (there is no in-repo precedent for
 * asserting on drizzle-generated SQL strings).
 */
describe("InstallCodeRepository.findByCode", () => {
    beforeEach(() => {
        dbMock.__reset();
    });

    it("returns the row when the update matches (code exists, not expired, under the attempt cap)", async () => {
        const row = {
            id: "id-1",
            code: "ABC234",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000),
            attempts: 3,
        };
        dbMock.__setUpdateResponse(() => Promise.resolve([row]));

        const repo = new InstallCodeRepository();
        const result = await repo.findByCode("abc234");

        expect(result).toEqual(row);
    });

    it("returns null when nothing matches — expired, unknown, and exhausted are indistinguishable by design", async () => {
        dbMock.__setUpdateResponse(() => Promise.resolve([]));

        const repo = new InstallCodeRepository();
        const result = await repo.findByCode("ZZZZZZ");

        expect(result).toBeNull();
    });

    it("exports a finite, positive attempt cap", () => {
        expect(MAX_RESOLVE_ATTEMPTS).toBeGreaterThan(0);
        expect(Number.isFinite(MAX_RESOLVE_ATTEMPTS)).toBe(true);
    });
});

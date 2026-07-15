import { describe, expect, it } from "vitest";
import { PasswordService } from "./PasswordService";

// `Bun.password` is unavailable in the Node test environment — substitute a
// deterministic stand-in with the same shape (hash marker + verify compare).
const bunPassword = {
    hash: async (password: string) => `hashed:${password}`,
    verify: async (password: string, hash: string) =>
        hash === `hashed:${password}`,
};
type GlobalWithBun = typeof globalThis & { Bun?: Record<string, unknown> };
const globalWithBun = globalThis as GlobalWithBun;
globalWithBun.Bun = { ...globalWithBun.Bun, password: bunPassword };

describe("PasswordService", () => {
    const service = new PasswordService();

    describe("isValidPassword", () => {
        it("rejects passwords under 10 chars", () => {
            expect(service.isValidPassword("short")).toBe(false);
            expect(service.isValidPassword("123456789")).toBe(false);
        });

        it("accepts passwords of 10+ chars", () => {
            expect(service.isValidPassword("longenough")).toBe(true);
        });

        it("rejects absurdly long passwords (DoS guard)", () => {
            expect(service.isValidPassword("x".repeat(129))).toBe(false);
            expect(service.isValidPassword("x".repeat(128))).toBe(true);
        });
    });

    describe("hash + verify", () => {
        it("round-trips", async () => {
            const hash = await service.hash("my-secret-password");
            expect(await service.verify("my-secret-password", hash)).toBe(true);
            expect(await service.verify("wrong-password", hash)).toBe(false);
        });
    });

    describe("verifyOrDummy", () => {
        it("verifies against a real hash", async () => {
            const hash = await service.hash("correct horse battery");
            expect(
                await service.verifyOrDummy("correct horse battery", hash)
            ).toBe(true);
        });

        it("returns false (after dummy work) when hash is missing", async () => {
            expect(await service.verifyOrDummy("anything", null)).toBe(false);
            expect(await service.verifyOrDummy("anything", undefined)).toBe(
                false
            );
        });
    });
});

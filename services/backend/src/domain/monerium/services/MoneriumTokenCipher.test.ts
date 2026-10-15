import { describe, expect, it } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import { MoneriumTokenCipher } from "./MoneriumTokenCipher";

describe("MoneriumTokenCipher", () => {
    const cipher = new MoneriumTokenCipher(new AdminWalletsRepository());

    it("round-trips a token", async () => {
        const blob = await cipher.encrypt("access-token-value");
        expect(blob).not.toContain("access-token-value");
        expect(await cipher.decrypt(blob)).toBe("access-token-value");
    });

    it("uses a fresh IV per value", async () => {
        const [a, b] = await Promise.all([
            cipher.encrypt("same"),
            cipher.encrypt("same"),
        ]);
        expect(a).not.toBe(b);
    });

    it("lays the blob out as iv, ciphertext, tag", async () => {
        const blob = await cipher.encrypt("abc");
        expect(blob.length).toBe(2 + (12 + 3 + 16) * 2);
    });

    it("rejects a tampered ciphertext", async () => {
        const blob = await cipher.encrypt("refresh-token");
        const flipped = `${blob.slice(0, 30)}${blob[30] === "0" ? "1" : "0"}${blob.slice(31)}`;
        await expect(cipher.decrypt(flipped)).rejects.toThrow();
    });

    it("rejects a tampered auth tag", async () => {
        const blob = await cipher.encrypt("refresh-token");
        const last = blob.length - 1;
        const flipped = `${blob.slice(0, last)}${blob[last] === "0" ? "1" : "0"}`;
        await expect(cipher.decrypt(flipped)).rejects.toThrow();
    });
});

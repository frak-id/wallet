import { describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import {
    MoneriumCipherIntegrityError,
    MoneriumTokenCipher,
} from "./MoneriumTokenCipher";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;
const OTHER = "0x00000000000000000000000000000000000000bb" as const;
const COLUMN = "access_token_encrypted" as const;

describe("MoneriumTokenCipher", () => {
    const cipher = new MoneriumTokenCipher(new AdminWalletsRepository());

    it("round-trips a token", async () => {
        const blob = await cipher.encrypt("access-token-value", WALLET, COLUMN);
        expect(blob).not.toContain("access-token-value");
        expect(await cipher.decrypt(blob, WALLET, COLUMN)).toBe(
            "access-token-value"
        );
    });

    it("uses a fresh IV per value", async () => {
        const [a, b] = await Promise.all([
            cipher.encrypt("same", WALLET, COLUMN),
            cipher.encrypt("same", WALLET, COLUMN),
        ]);
        expect(a).not.toBe(b);
    });

    it("lays the blob out as version, iv, ciphertext, tag", async () => {
        const blob = await cipher.encrypt("abc", WALLET, COLUMN);
        expect(blob.length).toBe(2 + (1 + 12 + 3 + 16) * 2);
        expect(blob.slice(2, 4)).toBe("01");
    });

    it("rejects a tampered ciphertext", async () => {
        const blob = await cipher.encrypt("refresh-token", WALLET, COLUMN);
        const flipped = `${blob.slice(0, 34)}${blob[34] === "0" ? "1" : "0"}${blob.slice(35)}`;
        await expect(
            cipher.decrypt(flipped, WALLET, COLUMN)
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
    });

    it("rejects a tampered auth tag", async () => {
        const blob = await cipher.encrypt("refresh-token", WALLET, COLUMN);
        const last = blob.length - 1;
        const flipped = `${blob.slice(0, last)}${blob[last] === "0" ? "1" : "0"}`;
        await expect(
            cipher.decrypt(flipped, WALLET, COLUMN)
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
    });

    it("rejects a blob copied to another wallet", async () => {
        const blob = await cipher.encrypt("refresh-token", WALLET, COLUMN);
        await expect(
            cipher.decrypt(blob, OTHER, COLUMN)
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
    });

    it("rejects a blob moved to another column", async () => {
        const blob = await cipher.encrypt("refresh-token", WALLET, COLUMN);
        await expect(
            cipher.decrypt(blob, WALLET, "refresh_token_encrypted")
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
    });

    it("rejects an unknown version byte and non-hex input", async () => {
        const blob = await cipher.encrypt("refresh-token", WALLET, COLUMN);
        await expect(
            cipher.decrypt(`0x02${blob.slice(4)}`, WALLET, COLUMN)
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
        await expect(
            cipher.decrypt("not-hex", WALLET, COLUMN)
        ).rejects.toBeInstanceOf(MoneriumCipherIntegrityError);
    });

    it("lets a key-loading failure through unchanged", async () => {
        const repository = new AdminWalletsRepository();
        vi.spyOn(repository, "deriveKeyBytes").mockRejectedValue(
            new Error("Missing MASTER_KEY_SECRET")
        );
        const broken = new MoneriumTokenCipher(repository);
        await expect(broken.decrypt("0x01", WALLET, COLUMN)).rejects.toThrow(
            "Missing MASTER_KEY_SECRET"
        );
    });
});

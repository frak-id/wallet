import { describe, expect, it } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import { SubscriptionCredentialsCipher } from "./SubscriptionCredentialsCipher";

const MERCHANT = "merchant-1";

describe("SubscriptionCredentialsCipher", () => {
    const cipher = new SubscriptionCredentialsCipher(
        new AdminWalletsRepository()
    );

    it("round-trips a token without leaving it readable", async () => {
        const blob = await cipher.encrypt("sk_live_secret", MERCHANT);

        expect(blob).not.toContain("sk_live_secret");
        expect(await cipher.decrypt(blob, MERCHANT)).toBe("sk_live_secret");
    });

    it("uses a fresh IV per value", async () => {
        const [a, b] = await Promise.all([
            cipher.encrypt("same", MERCHANT),
            cipher.encrypt("same", MERCHANT),
        ]);

        expect(a).not.toBe(b);
    });

    it("rejects a blob moved to another merchant", async () => {
        const blob = await cipher.encrypt("token", MERCHANT);

        await expect(cipher.decrypt(blob, "merchant-2")).rejects.toThrow();
    });

    it("rejects a malformed blob", async () => {
        await expect(cipher.decrypt("AAAA", MERCHANT)).rejects.toThrow(
            "Malformed"
        );
    });
});

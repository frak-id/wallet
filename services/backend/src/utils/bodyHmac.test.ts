import { describe, expect, it } from "vitest";
import { validateBodyHmac } from "./bodyHmac";

// The backend vitest setup (test/vitest-setup.ts) stubs Bun's `CryptoHasher`
// so `digest()` always returns `Buffer.from("mocked-hash")`. Signatures are
// therefore validated against that fixed digest — this exercises the
// timing-safe comparison + length guard, not the (stubbed) HMAC itself.
const secret = "my-webhook-secret";
const body = JSON.stringify({ order: "12345", amount: 42 });
const MOCK_DIGEST_B64 = Buffer.from("mocked-hash").toString("base64");

describe("validateBodyHmac", () => {
    it("accepts a correctly signed body", () => {
        expect(() =>
            validateBodyHmac({ body, secret, signature: MOCK_DIGEST_B64 })
        ).not.toThrow();
    });

    it("rejects a tampered signature of the same length", () => {
        // 11 bytes like "mocked-hash" but different content.
        const tampered = Buffer.from("mocked-hazh").toString("base64");
        expect(() =>
            validateBodyHmac({ body, secret, signature: tampered })
        ).toThrow("Webhook signature verification failed");
    });

    it("rejects a shorter-than-expected signature without throwing a RangeError", () => {
        const signature = Buffer.from("short").toString("base64");
        expect(() =>
            validateBodyHmac({ body, secret, signature })
        ).toThrow("Webhook signature verification failed");
    });

    it("rejects a longer-than-expected signature without throwing a RangeError", () => {
        const signature = Buffer.from("mocked-hash-and-more").toString("base64");
        expect(() =>
            validateBodyHmac({ body, secret, signature })
        ).toThrow("Webhook signature verification failed");
    });

    it("rejects a missing signature", () => {
        expect(() =>
            validateBodyHmac({ body, secret, signature: undefined })
        ).toThrow("Webhook signature verification failed");
    });
});

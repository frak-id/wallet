import type { Address, Hex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { describe, expect, it } from "vitest";
import { verifySiweSignature } from "./siwe";

// `verifyMessage` (viem/actions) is globally mocked to resolve `true`, so
// these tests exercise the parse → domain-validate → freshness pipeline in
// isolation from real signature recovery.

const ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
const ORIGIN = "https://example.com";
const SIGNATURE = `0x${"00".repeat(65)}` as Hex;

function buildMessage(issuedAt: Date | undefined): string {
    return createSiweMessage({
        address: ADDRESS,
        chainId: 1,
        domain: "example.com",
        nonce: "abcd1234",
        uri: ORIGIN,
        version: "1",
        ...(issuedAt ? { issuedAt } : {}),
    });
}

/** createSiweMessage always emits an `Issued At:` line; strip it to model a
 * malformed client message that omits the timestamp. */
function stripIssuedAt(message: string): string {
    return message
        .split("\n")
        .filter((line) => !line.startsWith("Issued At:"))
        .join("\n");
}

describe("verifySiweSignature freshness (§1.3)", () => {
    it("accepts a freshly-issued message", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date()),
            signature: SIGNATURE,
            requestOrigin: ORIGIN,
            requireFreshness: true,
        });
        expect(result).toEqual({
            valid: true,
            wallet: ADDRESS,
            nonce: "abcd1234",
        });
    });

    it("rejects a message older than the 2-minute window", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date(Date.now() - 3 * 60 * 1000)),
            signature: SIGNATURE,
            requestOrigin: ORIGIN,
            requireFreshness: true,
        });
        expect(result).toEqual({ valid: false, error: expect.any(String) });
        expect(result).toMatchObject({ valid: false });
        if (!result.valid) expect(result.error).toMatch(/expired/i);
    });

    it("rejects a message issued in the future beyond the skew", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date(Date.now() + 2 * 60 * 1000)),
            signature: SIGNATURE,
            requestOrigin: ORIGIN,
            requireFreshness: true,
        });
        expect(result).toMatchObject({ valid: false });
        if (!result.valid) expect(result.error).toMatch(/future/i);
    });

    it("rejects a message missing issuedAt", async () => {
        const result = await verifySiweSignature({
            message: stripIssuedAt(buildMessage(new Date())),
            signature: SIGNATURE,
            requestOrigin: ORIGIN,
            requireFreshness: true,
        });
        expect(result).toMatchObject({ valid: false });
        if (!result.valid) expect(result.error).toMatch(/issuedAt/i);
    });

    it("ignores age when freshness is not required (default off)", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date(Date.now() - 3 * 60 * 1000)),
            signature: SIGNATURE,
            requestOrigin: ORIGIN,
        });
        expect(result).toMatchObject({ valid: true, wallet: ADDRESS });
    });
});

describe("verifySiweSignature validation", () => {
    it("fails cleanly on a missing/invalid Origin header", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date()),
            signature: SIGNATURE,
            requestOrigin: "",
        });
        expect(result).toMatchObject({ valid: false });
        if (!result.valid) expect(result.error).toMatch(/origin/i);
    });

    it("rejects a domain that does not match the request origin", async () => {
        const result = await verifySiweSignature({
            message: buildMessage(new Date()),
            signature: SIGNATURE,
            requestOrigin: "https://evil.com",
            requireFreshness: true,
        });
        expect(result).toMatchObject({ valid: false });
        if (!result.valid) expect(result.error).toMatch(/validation failed/i);
    });
});

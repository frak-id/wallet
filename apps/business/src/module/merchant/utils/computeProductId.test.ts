import { keccak256, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { computeProductId } from "./computeProductId";

describe("computeProductId", () => {
    it("should compute productId from domain", () => {
        const domain = "example.com";
        const productId = computeProductId(domain);

        const expectedProductId = keccak256(toHex("example.com"));
        expect(productId).toBe(expectedProductId);
    });

    it("should remove www prefix before computing hash", () => {
        const domain = "www.example.com";
        const productId = computeProductId(domain);

        const expectedProductId = keccak256(toHex("example.com"));
        expect(productId).toBe(expectedProductId);
    });

    it("should return valid Hex format", () => {
        const productId = computeProductId("test.com");
        expect(productId).toMatch(/^0x[a-f0-9]{64}$/i);
    });
});

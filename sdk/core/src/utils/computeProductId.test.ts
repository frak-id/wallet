/**
 * Tests for computeProductId utility function
 * Tests product ID computation from domain names with normalization
 */

import { keccak256, toHex } from "viem";
import { describe, expect, it } from "../../tests/vitest-fixtures";
import { computeProductId } from "./computeProductId";

describe("computeProductId", () => {
    it("should compute product ID from current domain (window.location.host)", () => {
        // Mock window.location.host is set to "localhost" in vitest-setup.ts
        const productId = computeProductId();

        // Should compute keccak256 hash of "localhost"
        const expectedId = keccak256(toHex("localhost"));
        expect(productId).toBe(expectedId);
    });

    it("should compute product ID from custom domain", () => {
        const customDomain = "custom-domain.com";
        const productId = computeProductId({ domain: customDomain });

        // Should compute keccak256 hash of custom domain
        const expectedId = keccak256(toHex(customDomain));
        expect(productId).toBe(expectedId);
    });

    it("should remove www. prefix from domain before hashing", () => {
        const domainWithWww = "www.example.com";
        const productId = computeProductId({ domain: domainWithWww });

        // Should compute keccak256 hash of "example.com" (www. removed)
        const expectedId = keccak256(toHex("example.com"));
        expect(productId).toBe(expectedId);
    });

    it("should produce same product ID for domain with and without www", () => {
        const withWww = computeProductId({ domain: "www.example.com" });
        const withoutWww = computeProductId({ domain: "example.com" });

        // Both should produce the same hash
        expect(withWww).toBe(withoutWww);
    });

    it("should produce different product IDs for different domains", () => {
        const domain1ProductId = computeProductId({ domain: "domain1.com" });
        const domain2ProductId = computeProductId({ domain: "domain2.com" });

        // Different domains should produce different hashes
        expect(domain1ProductId).not.toBe(domain2ProductId);
    });

    it("should use window.location.host when domain is not provided", () => {
        // When no domain is provided, it should default to window.location.host
        const productId = computeProductId();

        // Should produce same result as using window.location.host explicitly
        const expectedId = keccak256(toHex(window.location.host));
        expect(productId).toBe(expectedId);
    });

    it("should handle subdomains correctly", () => {
        const subdomain = "blog.example.com";
        const productId = computeProductId({ domain: subdomain });

        // Should compute keccak256 hash of "blog.example.com" (subdomain preserved)
        const expectedId = keccak256(toHex(subdomain));
        expect(productId).toBe(expectedId);
    });

    it("should only remove www prefix, not other w-prefixed subdomains", () => {
        const domain = "web.example.com";
        const productId = computeProductId({ domain });

        // Should NOT remove "web." prefix, only "www."
        const expectedId = keccak256(toHex("web.example.com"));
        expect(productId).toBe(expectedId);
    });
});

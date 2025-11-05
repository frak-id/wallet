import { describe, expect, it } from "vitest";
import { viemClient } from "./provider";

describe("blockchain provider", () => {
    describe("viemClient", () => {
        it("should be defined", () => {
            expect(viemClient).toBeDefined();
        });

        it("should have request method", () => {
            expect(viemClient.request).toBeDefined();
            expect(typeof viemClient.request).toBe("function");
        });

        it("should have chain property", () => {
            expect(viemClient.chain).toBeDefined();
            expect(viemClient.chain).toHaveProperty("id");
            expect(viemClient.chain).toHaveProperty("name");
        });

        it("should use Arbitrum Sepolia chain in test environment", () => {
            // In test environment, should use testnet
            expect(viemClient.chain?.id).toBe(421614); // Arbitrum Sepolia
        });

        it("should have transport configured", () => {
            expect(viemClient.transport).toBeDefined();
        });

        it("should have account property", () => {
            // account is optional, but property should exist
            expect(viemClient).toHaveProperty("account");
        });
    });
});

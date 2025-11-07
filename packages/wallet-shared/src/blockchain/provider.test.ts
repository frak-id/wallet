import { isRunningInProd } from "@frak-labs/app-essentials";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { describe, expect, it } from "vitest";
import { currentChain, currentViemClient } from "./provider";

describe("blockchain provider", () => {
    describe("currentChain", () => {
        it("should be defined", () => {
            expect(currentChain).toBeDefined();
        });

        it("should be a valid chain object", () => {
            expect(currentChain).toHaveProperty("id");
            expect(currentChain).toHaveProperty("name");
            expect(currentChain).toHaveProperty("rpcUrls");
        });

        it("should be arbitrum or arbitrumSepolia based on environment", () => {
            if (isRunningInProd) {
                expect(currentChain.id).toBe(arbitrum.id);
                expect(currentChain.name).toBe(arbitrum.name);
            } else {
                expect(currentChain.id).toBe(arbitrumSepolia.id);
                expect(currentChain.name).toBe(arbitrumSepolia.name);
            }
        });

        it("should have a valid chain id", () => {
            expect(typeof currentChain.id).toBe("number");
            expect(currentChain.id).toBeGreaterThan(0);
        });

        it("should have RPC URLs", () => {
            expect(currentChain.rpcUrls).toBeDefined();
            expect(currentChain.rpcUrls.default).toBeDefined();
        });
    });

    describe("currentViemClient", () => {
        it("should be defined", () => {
            expect(currentViemClient).toBeDefined();
        });

        it("should be a client object", () => {
            expect(typeof currentViemClient).toBe("object");
            expect(currentViemClient).not.toBeNull();
        });

        it("should have chain property matching currentChain", () => {
            expect(currentViemClient.chain).toBeDefined();
            expect(currentViemClient.chain?.id).toBe(currentChain.id);
        });

        it("should have transport configured", () => {
            expect(currentViemClient.transport).toBeDefined();
        });

        it("should have expected client methods", () => {
            expect(currentViemClient).toHaveProperty("request");
        });
    });

    describe("provider consistency", () => {
        it("should have matching chain between currentChain and currentViemClient", () => {
            expect(currentViemClient.chain?.id).toBe(currentChain.id);
            expect(currentViemClient.chain?.name).toBe(currentChain.name);
        });
    });
});

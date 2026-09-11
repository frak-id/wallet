import { isRunningInProd } from "@frak-labs/app-essentials";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { describe, expect, it } from "vitest";
import { currentChain, currentViemClient } from "./provider";

describe("blockchain provider", () => {
    it("picks the chain matching the environment", () => {
        const expected = isRunningInProd ? arbitrum : arbitrumSepolia;
        expect(currentChain.id).toBe(expected.id);
        expect(currentChain.name).toBe(expected.name);
    });

    it("builds the client on that same chain", () => {
        expect(currentViemClient.chain?.id).toBe(currentChain.id);
        expect(currentViemClient.chain?.name).toBe(currentChain.name);
    });
});

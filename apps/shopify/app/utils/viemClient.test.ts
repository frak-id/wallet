import { arbitrum, arbitrumSepolia } from "viem/chains";
import { describe, expect, it } from "vitest";
import { buildRpcUrl, getChainConfig } from "./viemClient";

describe("chain config selection", () => {
    it("selects arbitrum for production", () => {
        const { chain, baseUrl } = getChainConfig("production");
        expect(chain.id).toBe(arbitrum.id);
        expect(baseUrl).toBe("https://erpc.gcp.frak.id/nexus-rpc/evm");
    });

    it("selects arbitrumSepolia for dev", () => {
        const { chain, baseUrl } = getChainConfig("dev");
        expect(chain.id).toBe(arbitrumSepolia.id);
        expect(baseUrl).toBe("https://erpc.gcp-dev.frak.id/nexus-rpc/evm");
    });

    it("selects arbitrumSepolia for undefined stage", () => {
        const { chain } = getChainConfig(undefined);
        expect(chain.id).toBe(arbitrumSepolia.id);
    });

    it("selects arbitrumSepolia for any non-production stage", () => {
        const { chain } = getChainConfig("staging");
        expect(chain.id).toBe(arbitrumSepolia.id);
    });
});

describe("RPC URL building", () => {
    it("builds correct URL with chain ID and token", () => {
        const url = buildRpcUrl(
            "https://erpc.gcp.frak.id/nexus-rpc/evm",
            42161,
            "secret123"
        );
        expect(url).toBe(
            "https://erpc.gcp.frak.id/nexus-rpc/evm/42161?token=secret123"
        );
    });

    it("builds dev URL correctly", () => {
        const url = buildRpcUrl(
            "https://erpc.gcp-dev.frak.id/nexus-rpc/evm",
            421614,
            "dev-secret"
        );
        expect(url).toContain("gcp-dev.frak.id");
        expect(url).toContain("421614");
        expect(url).toContain("token=dev-secret");
    });
});

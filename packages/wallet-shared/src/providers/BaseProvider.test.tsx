import { render } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { WagmiProviderWithDynamicConfig } from "./BaseProvider";

vi.mock("@frak-labs/app-essentials/blockchain", () => ({
    getTransport: vi.fn(() => ({ type: "http" })),
}));

vi.mock("wagmi", () => ({
    WagmiProvider: vi.fn(({ children }) => children),
    createConfig: vi.fn(() => ({ chains: [] })),
}));

vi.mock("viem", () => ({
    createClient: vi.fn(() => ({ type: "client" })),
}));

vi.mock("../blockchain/provider", () => ({
    currentChain: {
        id: 1,
        name: "Ethereum",
    },
}));

vi.mock("../wallet/smartWallet/connector", () => ({
    smartAccountConnector: vi.fn(() => ({ type: "connector" })),
}));

describe("WagmiProviderWithDynamicConfig", () => {
    test("should not throw when rendering", () => {
        expect(() =>
            render(
                <WagmiProviderWithDynamicConfig>
                    <div>Test Content</div>
                </WagmiProviderWithDynamicConfig>
            )
        ).not.toThrow();
    });

    test("should create config on mount", async () => {
        const { createConfig } = await import("wagmi");

        render(
            <WagmiProviderWithDynamicConfig>
                <div>Test</div>
            </WagmiProviderWithDynamicConfig>
        );

        expect(createConfig).toHaveBeenCalled();
    });

    test("should use smart account connector", async () => {
        const { smartAccountConnector } = await import(
            "../wallet/smartWallet/connector"
        );

        render(
            <WagmiProviderWithDynamicConfig>
                <div>Test</div>
            </WagmiProviderWithDynamicConfig>
        );

        expect(smartAccountConnector).toHaveBeenCalled();
    });

    test("should memoize config", async () => {
        const { createConfig } = await import("wagmi");

        const { rerender } = render(
            <WagmiProviderWithDynamicConfig>
                <div>Test</div>
            </WagmiProviderWithDynamicConfig>
        );

        const callCount = vi.mocked(createConfig).mock.calls.length;

        rerender(
            <WagmiProviderWithDynamicConfig>
                <div>Test 2</div>
            </WagmiProviderWithDynamicConfig>
        );

        // Config should not be recreated on rerender
        expect(vi.mocked(createConfig).mock.calls.length).toBe(callCount);
    });
});

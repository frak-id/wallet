/**
 * React SDK test fixtures, extending the base ones from @frak-labs/wallet-shared.
 */

import type { FrakClient, FrakWalletSdkConfig } from "@frak-labs/core-sdk";
import { test as baseTest } from "@frak-labs/wallet-shared/tests/vitest-fixtures";
import { createElement, type ReactElement } from "react";
import { FrakConfigProvider } from "../src/provider/FrakConfigProvider";
import { FrakIFrameClientContext } from "../src/provider/FrakIFrameClientProvider";

export type ReactSdkTestFixtures = {
    /**
     * Mock FrakClient for testing
     */
    mockFrakClient: FrakClient;

    /**
     * Mock FrakWalletSdkConfig for testing
     */
    mockFrakConfig: FrakWalletSdkConfig;

    /**
     * Combined provider wrapper that includes:
     * - QueryClientProvider (from queryWrapper)
     * - FrakConfigProvider
     * - FrakIFrameClientContext.Provider
     *
     * Use this for testing hooks that require all providers
     */
    mockFrakProviders: ({
        children,
    }: {
        children: React.ReactNode;
    }) => ReactElement;
};

export const test = baseTest.extend<ReactSdkTestFixtures>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockFrakClient: async ({}, use) => {
        const { vi } = await import("vitest");
        const mockClient: FrakClient = {
            config: {
                domain: "example.com",
                env: {
                    wallet: "https://wallet-test.frak.id",
                    backend: "https://backend-test.frak.id",
                },
                metadata: {
                    name: "Test App",
                },
            },
            request: vi.fn().mockResolvedValue({}),
            listenerUrl: "https://wallet-test.frak.id/listener",
        } as unknown as FrakClient;
        await use(mockClient);
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockFrakConfig: async ({}, use) => {
        const config: FrakWalletSdkConfig = {
            domain: "example.com",
            env: {
                wallet: "https://wallet-test.frak.id",
                backend: "https://backend-test.frak.id",
            },
            metadata: {
                name: "Test App",
                logoUrl: "https://example.com/logo.png",
            },
            customizations: {
                css: "https://example.com/styles.css",
            },
        };
        await use(config);
    },

    /**
     * Combined QueryClient + FrakConfig + FrakClient provider wrapper.
     */
    mockFrakProviders: async (
        { queryWrapper, mockFrakConfig, mockFrakClient },
        use
    ) => {
        const wrapper = ({ children }: { children: React.ReactNode }) => {
            const withQueryProvider = queryWrapper.wrapper({ children });
            const withConfigProvider = createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                withQueryProvider
            );
            return createElement(
                FrakIFrameClientContext.Provider,
                { value: mockFrakClient },
                withConfigProvider
            );
        };

        await use(wrapper);
    },
});

export const { beforeEach, afterEach, beforeAll, afterAll } = test;

export * from "@frak-labs/wallet-shared/tests/vitest-fixtures";
export { describe, expect, it, vi } from "vitest";

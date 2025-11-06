/**
 * React SDK test fixtures using Vitest's test.extend
 * Extends base fixtures from @frak-labs/wallet-shared
 *
 * This file provides React SDK-specific fixtures that complement the base fixtures
 * from wallet-shared, including mocks for FrakClient, FrakConfig, and core SDK actions.
 */

import type {
    FrakClient,
    FrakWalletSdkConfig,
    WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import { test as baseTest } from "@frak-labs/wallet-shared/tests/vitest-fixtures";
import { createElement, type ReactElement } from "react";
import { FrakConfigProvider } from "../src/provider/FrakConfigProvider";
import { FrakIFrameClientContext } from "../src/provider/FrakIFrameClientProvider";

/**
 * React SDK-specific test fixtures
 * Extends BaseTestFixtures from wallet-shared
 */
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
     * Mock WalletStatusReturnType for testing
     */
    mockWalletStatus: WalletStatusReturnType;

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

    /**
     * Mock core SDK actions (all mocked with vi.fn())
     * Use vi.mocked() to customize behavior in tests
     */
    mockCoreActions: {
        displayModal: ReturnType<typeof import("vitest").vi.fn>;
        displayEmbeddedWallet: ReturnType<typeof import("vitest").vi.fn>;
        openSso: ReturnType<typeof import("vitest").vi.fn>;
        prepareSso: ReturnType<typeof import("vitest").vi.fn>;
        getProductInformation: ReturnType<typeof import("vitest").vi.fn>;
        sendInteraction: ReturnType<typeof import("vitest").vi.fn>;
        trackPurchaseStatus: ReturnType<typeof import("vitest").vi.fn>;
        watchWalletStatus: ReturnType<typeof import("vitest").vi.fn>;
        sendTransaction: ReturnType<typeof import("vitest").vi.fn>;
        siweAuthenticate: ReturnType<typeof import("vitest").vi.fn>;
        processReferral: ReturnType<typeof import("vitest").vi.fn>;
        referralInteraction: ReturnType<typeof import("vitest").vi.fn>;
    };
};

/**
 * Extended test with React SDK fixtures
 * Extends base test from wallet-shared with React SDK-specific fixtures
 *
 * @example
 * ```ts
 * import { test, expect } from './tests/vitest-fixtures';
 *
 * test('should use Frak client', ({ mockFrakClient, mockFrakConfig }) => {
 *     expect(mockFrakClient).toBeDefined();
 *     expect(mockFrakConfig.domain).toBe('example.com');
 * });
 * ```
 */
export const test = baseTest.extend<ReactSdkTestFixtures>({
    /**
     * Provides a mock FrakClient with request method
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockFrakClient: async ({}, use) => {
        const { vi } = await import("vitest");
        const mockClient: FrakClient = {
            config: {
                domain: "example.com",
                walletUrl: "https://wallet-test.frak.id",
                metadata: {
                    name: "Test App",
                },
            },
            request: vi.fn().mockResolvedValue({}),
            listenerUrl: "https://wallet-test.frak.id/listener",
        } as unknown as FrakClient;
        await use(mockClient);
    },

    /**
     * Provides a mock FrakWalletSdkConfig
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockFrakConfig: async ({}, use) => {
        const config: FrakWalletSdkConfig = {
            domain: "example.com",
            walletUrl: "https://wallet-test.frak.id",
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
     * Provides a mock WalletStatusReturnType
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockWalletStatus: async ({}, use) => {
        const { createMockAddress } = await import(
            "@frak-labs/wallet-shared/test"
        );
        const status: WalletStatusReturnType = {
            key: "connected",
            wallet: createMockAddress(),
        };
        await use(status);
    },

    /**
     * Provides combined provider wrapper for testing
     * Includes QueryClient, FrakConfig, and FrakClient providers
     */
    mockFrakProviders: async (
        { queryWrapper, mockFrakConfig, mockFrakClient },
        use
    ) => {
        // Create a wrapper that combines all providers
        const wrapper = ({ children }: { children: React.ReactNode }) => {
            // Wrap with QueryClientProvider first
            const withQueryProvider = queryWrapper.wrapper({ children });

            // Then wrap with FrakConfigProvider
            const withConfigProvider = createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                withQueryProvider
            );

            // Finally wrap with FrakIFrameClientContext.Provider
            return createElement(
                FrakIFrameClientContext.Provider,
                { value: mockFrakClient },
                withConfigProvider
            );
        };

        await use(wrapper);
    },

    /**
     * Provides mock core SDK action functions
     * All actions are mocked with vi.fn() and can be customized in tests
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockCoreActions: async ({}, use) => {
        const { vi } = await import("vitest");

        const actions = {
            displayModal: vi.fn(),
            displayEmbeddedWallet: vi.fn(),
            openSso: vi.fn(),
            prepareSso: vi.fn(),
            getProductInformation: vi.fn(),
            sendInteraction: vi.fn(),
            trackPurchaseStatus: vi.fn(),
            watchWalletStatus: vi.fn(),
            sendTransaction: vi.fn(),
            siweAuthenticate: vi.fn(),
            processReferral: vi.fn(),
            referralInteraction: vi.fn(),
        };

        await use(actions);
    },
});

/**
 * Type-aware hooks that have access to fixtures
 *
 * @example
 * ```ts
 * import { test, beforeEach } from './tests/vitest-fixtures';
 *
 * beforeEach(({ mockFrakClient, mockFrakConfig }) => {
 *     // Setup with typed fixtures
 *     console.log(`Testing with domain: ${mockFrakConfig.domain}`);
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export everything from wallet-shared fixtures
 * This includes: queryClient, queryWrapper, mockAddress, mockSession, stores, etc.
 */
export * from "@frak-labs/wallet-shared/tests/vitest-fixtures";

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";

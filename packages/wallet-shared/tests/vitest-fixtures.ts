/**
 * Base `test.extend` fixtures shared by wallet-shared, the wallet app and the
 * listener app. App-specific fixtures extend these in their own files.
 */

import type { SdkSession, Session } from "@frak-labs/wallet-shared";
import {
    createMockAddress,
    createMockSdkSession,
    createMockSession,
} from "@frak-labs/wallet-shared/test";
import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { test as baseTest } from "vitest";

export type BaseTestFixtures = {
    mockAddress: Address;
    mockSession: Session;
    mockSdkSession: SdkSession;
    queryClient: QueryClient;

    /** `queryClient` plus a ready-to-use provider wrapper for `renderHook`. */
    queryWrapper: {
        client: QueryClient;
        wrapper: ({
            children,
        }: {
            children: React.ReactNode;
        }) => React.ReactElement;
    };

    /** Zustand stores that auto-reset after each test. */
    freshSessionStore: typeof import("@frak-labs/wallet-shared").sessionStore;
    freshAuthenticationStore: typeof import("@frak-labs/wallet-shared").authenticationStore;

    mockWagmiHooks: {
        useConnection: ReturnType<typeof import("vitest").vi.fn>;
    };
};

export const test = baseTest.extend<BaseTestFixtures>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAddress: async ({}, use) => {
        const address = createMockAddress();
        await use(address);
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockSession: async ({}, use) => {
        const session = createMockSession({
            address: createMockAddress(),
            token: "test-session-token",
        });
        await use(session);
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockSdkSession: async ({}, use) => {
        const sdkSession = createMockSdkSession({
            token: "test-sdk-token",
            expires: Date.now() + 3600000, // 1 hour from now
        });
        await use(sdkSession);
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    queryClient: async ({}, use) => {
        const { QueryClient } = await import("@tanstack/react-query");
        const client = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                },
                mutations: {
                    retry: false,
                },
            },
        });

        await use(client);

        // Cleanup
        client.clear();
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    queryWrapper: async ({}, use) => {
        const { QueryClient, QueryClientProvider } = await import(
            "@tanstack/react-query"
        );
        const React = await import("react");

        const client = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: 0 },
                mutations: { retry: false },
            },
        });

        const wrapper = ({ children }: { children: React.ReactNode }) => {
            return React.createElement(
                QueryClientProvider,
                { client },
                children
            );
        };

        await use({ client, wrapper });

        client.clear();
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshSessionStore: async ({}, use) => {
        const { sessionStore } = await import("@frak-labs/wallet-shared");
        await use(sessionStore);
        sessionStore.getState().clearSession();
    },

    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshAuthenticationStore: async ({}, use) => {
        const { authenticationStore } = await import(
            "@frak-labs/wallet-shared"
        );
        await use(authenticationStore);
        authenticationStore.setState({
            lastAuthenticator: null,
            lastRemoteAuthenticator: null,
            pendingRegistration: null,
            lastAuthenticationAt: null,
            ssoContext: null,
        });
    },

    mockWagmiHooks: async ({ mockAddress }, use) => {
        const { vi } = await import("vitest");
        await use({
            useConnection: vi.fn().mockReturnValue({
                address: mockAddress,
                isConnected: true,
                isConnecting: false,
                isDisconnected: false,
            }),
        });
    },
});

/** Fixture-aware hooks: `beforeEach(({ mockSession }) => ...)`. */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

export { describe, expect, it, vi } from "vitest";

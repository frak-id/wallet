/**
 * Type-aware test fixtures using Vitest 4's test.extend
 * Provides reusable, typed test setup for wallet app tests
 */

import type {
    InteractionSession,
    SdkSession,
    Session,
} from "@frak-labs/wallet-shared";
import {
    createMockAddress,
    createMockInteractionSession,
    createMockSdkSession,
    createMockSession,
} from "@frak-labs/wallet-shared/test";
import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { test as baseTest } from "vitest";

/**
 * Type-safe test fixtures for wallet app
 */
export type WalletTestFixtures = {
    /**
     * Mock wallet address
     */
    mockAddress: Address;

    /**
     * Mock WebAuthN session with default values
     */
    mockSession: Session;

    /**
     * Mock SDK session with default values
     */
    mockSdkSession: SdkSession;

    /**
     * Mock interaction session with default values
     */
    mockInteractionSession: InteractionSession;

    /**
     * Fresh QueryClient instance for each test
     */
    queryClient: QueryClient;

    /**
     * Fresh recovery store that auto-resets before and after each test
     */
    freshRecoveryStore: typeof import("@/module/stores/recoveryStore").recoveryStore;

    /**
     * Mock notification context with default values
     */
    mockNotificationContext: {
        subscription: PushSubscription | undefined;
        setSubscription: ReturnType<typeof import("vitest").vi.fn>;
        clearSubscription: ReturnType<typeof import("vitest").vi.fn>;
    };

    /**
     * Query wrapper with client and provider component
     * Combines queryClient with ready-to-use wrapper component
     */
    queryWrapper: {
        client: QueryClient;
        wrapper: ({
            children,
        }: {
            children: React.ReactNode;
        }) => React.ReactElement;
    };

    /**
     * Fresh Zustand stores that auto-reset before/after each test
     */
    freshSessionStore: typeof import("@frak-labs/wallet-shared").sessionStore;
    freshWalletStore: typeof import("@frak-labs/wallet-shared").walletStore;
    freshUserStore: typeof import("@frak-labs/wallet-shared").userStore;
    freshAuthenticationStore: typeof import("@frak-labs/wallet-shared").authenticationStore;

    /**
     * Mock store action functions (useful when mocking stores)
     */
    mockStoreActions: {
        session: {
            setSession: ReturnType<typeof import("vitest").vi.fn>;
            setSdkSession: ReturnType<typeof import("vitest").vi.fn>;
            clearSession: ReturnType<typeof import("vitest").vi.fn>;
        };
        authentication: {
            setLastWebAuthNAction: ReturnType<typeof import("vitest").vi.fn>;
            setLastAuthenticator: ReturnType<typeof import("vitest").vi.fn>;
            clearAuthentication: ReturnType<typeof import("vitest").vi.fn>;
        };
        user: {
            setUser: ReturnType<typeof import("vitest").vi.fn>;
            clearUser: ReturnType<typeof import("vitest").vi.fn>;
        };
        wallet: {
            setInteractionSession: ReturnType<typeof import("vitest").vi.fn>;
            addPendingInteraction: ReturnType<typeof import("vitest").vi.fn>;
            cleanPendingInteractions: ReturnType<typeof import("vitest").vi.fn>;
        };
    };

    /**
     * Mock Wagmi hooks (useAccount, useSendTransaction, etc.)
     */
    mockWagmiHooks: {
        useAccount: ReturnType<typeof import("vitest").vi.fn>;
        useSendTransaction: ReturnType<typeof import("vitest").vi.fn>;
        useWriteContract: ReturnType<typeof import("vitest").vi.fn>;
        useWaitForTransactionReceipt: ReturnType<typeof import("vitest").vi.fn>;
    };

    /**
     * Mock backend API clients
     */
    mockBackendAPI: {
        balance: {
            get: ReturnType<typeof import("vitest").vi.fn>;
        };
        auth: {
            login: {
                post: ReturnType<typeof import("vitest").vi.fn>;
            };
        };
        interactions: {
            push: ReturnType<typeof import("vitest").vi.fn>;
        };
    };

    /**
     * Mock WebAuthN APIs
     */
    mockWebAuthN: {
        startAuthentication: ReturnType<typeof import("vitest").vi.fn>;
        generateAuthenticationOptions: ReturnType<
            typeof import("vitest").vi.fn
        >;
        mockAuthResponse: Record<string, unknown>; // AuthenticationResponseJSON type
        mockAuthOptions: Record<string, unknown>; // PublicKeyCredentialRequestOptions type
    };

    /**
     * Mock browser APIs (Notification, ServiceWorker, PushManager)
     */
    mockBrowserAPIs: {
        mockNotificationAPI: (
            permission: "default" | "granted" | "denied"
        ) => void;
        mockServiceWorkerAPI: () => void;
        mockPushManagerAPI: () => void;
        restoreBrowserAPIs: () => void;
    };
};

/**
 * Extended test with wallet-specific fixtures
 * Use this instead of the base test for wallet component tests
 *
 * @example
 * ```ts
 * import { test, expect } from '@/tests/fixtures';
 *
 * test('should use mock wallet', ({ mockAddress, mockSession }) => {
 *     // mockAddress and mockSession are fully typed and available
 *     expect(mockAddress).toBeDefined();
 *     expect(mockSession.type).toBe('webauthn');
 * });
 * ```
 */
export const test = baseTest.extend<WalletTestFixtures>({
    /**
     * Provides a consistent mock address for all tests
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockAddress: async ({}, use) => {
        const address = createMockAddress();
        await use(address);
    },

    /**
     * Provides a fresh mock session for each test
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockSession: async ({}, use) => {
        const session = createMockSession({
            address: createMockAddress(),
            token: "test-session-token",
        });
        await use(session);
    },

    /**
     * Provides a fresh SDK session for each test
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockSdkSession: async ({}, use) => {
        const sdkSession = createMockSdkSession({
            token: "test-sdk-token",
            expires: Date.now() + 3600000, // 1 hour from now
        });
        await use(sdkSession);
    },

    /**
     * Provides a mock interaction session for each test
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockInteractionSession: async ({}, use) => {
        const interactionSession = createMockInteractionSession({
            sessionStart: Date.now() - 3600000, // 1 hour ago
            sessionEnd: Date.now() + 3600000, // 1 hour from now
        });
        await use(interactionSession);
    },

    /**
     * Provides a fresh QueryClient for each test
     * Automatically cleaned up after the test
     */
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

    /**
     * Provides a fresh recovery store that auto-resets
     * Store is reset before and after each test
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshRecoveryStore: async ({}, use) => {
        const { recoveryStore } = await import("@/module/stores/recoveryStore");

        // Reset before use
        recoveryStore.getState().reset();

        await use(recoveryStore);

        // Reset after use
        recoveryStore.getState().reset();
    },

    /**
     * Provides a mock notification context
     * Returns default mock values for testing notification features
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockNotificationContext: async ({}, use) => {
        const { vi } = await import("vitest");
        const context = {
            subscription: undefined as PushSubscription | undefined,
            setSubscription: vi.fn(),
            clearSubscription: vi.fn(),
        };

        await use(context);
    },

    /**
     * Provides query wrapper with client and provider component
     * Combines queryClient with ready-to-use wrapper for renderHook
     */
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

    /**
     * Provides fresh sessionStore that auto-resets
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshSessionStore: async ({}, use) => {
        const { sessionStore } = await import("@frak-labs/wallet-shared");
        sessionStore.getState().clearSession();
        await use(sessionStore);
        sessionStore.getState().clearSession();
    },

    /**
     * Provides fresh walletStore that auto-resets
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshWalletStore: async ({}, use) => {
        const { walletStore } = await import("@frak-labs/wallet-shared");
        walletStore.getState().cleanPendingInteractions();
        walletStore.getState().setInteractionSession(null);
        await use(walletStore);
        walletStore.getState().cleanPendingInteractions();
        walletStore.getState().setInteractionSession(null);
    },

    /**
     * Provides fresh userStore that auto-resets
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshUserStore: async ({}, use) => {
        const { userStore } = await import("@frak-labs/wallet-shared");
        userStore.getState().clearUser();
        await use(userStore);
        userStore.getState().clearUser();
    },

    /**
     * Provides fresh authenticationStore that auto-resets
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    freshAuthenticationStore: async ({}, use) => {
        const { authenticationStore } = await import(
            "@frak-labs/wallet-shared"
        );
        authenticationStore.getState().clearAuthentication();
        await use(authenticationStore);
        authenticationStore.getState().clearAuthentication();
    },

    /**
     * Provides mock store action functions
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockStoreActions: async ({}, use) => {
        const { vi } = await import("vitest");
        const actions = {
            session: {
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                clearSession: vi.fn(),
            },
            authentication: {
                setLastWebAuthNAction: vi.fn(),
                setLastAuthenticator: vi.fn(),
                clearAuthentication: vi.fn(),
            },
            user: {
                setUser: vi.fn(),
                clearUser: vi.fn(),
            },
            wallet: {
                setInteractionSession: vi.fn(),
                addPendingInteraction: vi.fn(),
                cleanPendingInteractions: vi.fn(),
            },
        };
        await use(actions);
    },

    /**
     * Provides mock Wagmi hooks
     */
    mockWagmiHooks: async ({ mockAddress }, use) => {
        const { vi } = await import("vitest");
        const mocks = {
            useAccount: vi.fn().mockReturnValue({
                address: mockAddress,
                isConnected: true,
                isConnecting: false,
                isDisconnected: false,
            }),
            useSendTransaction: vi.fn().mockReturnValue({
                sendTransactionAsync: vi.fn().mockResolvedValue("0xtxhash"),
                sendTransaction: vi.fn(),
                isPending: false,
                isSuccess: false,
                isError: false,
            }),
            useWriteContract: vi.fn().mockReturnValue({
                writeContractAsync: vi
                    .fn()
                    .mockResolvedValue("0xtxhash" as `0x${string}`),
                writeContract: vi.fn(),
                isPending: false,
                isSuccess: false,
                isError: false,
            }),
            useWaitForTransactionReceipt: vi.fn().mockReturnValue({
                data: { status: "success" as const },
                isLoading: false,
                isSuccess: true,
                isError: false,
            }),
        };
        await use(mocks);
    },

    /**
     * Provides mock backend API
     */
    mockBackendAPI: async ({ mockAddress, mockSession }, use) => {
        const { vi } = await import("vitest");
        const mocks = {
            balance: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        balance: "1000000",
                        formatted: "1.0",
                        address: mockAddress,
                    },
                    error: null,
                }),
            },
            auth: {
                login: {
                    post: vi.fn().mockResolvedValue({
                        data: mockSession,
                        error: null,
                    }),
                },
            },
            interactions: {
                push: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            },
        };
        await use(mocks);
    },

    /**
     * Provides mock WebAuthN APIs
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockWebAuthN: async ({}, use) => {
        const { vi } = await import("vitest");

        const mockAuthResponse = {
            id: "credential-id",
            rawId: "credential-id",
            response: {
                clientDataJSON: "client-data",
                authenticatorData: "auth-data",
                signature: "signature",
                userHandle: "user-handle",
            },
            type: "public-key" as const,
        };

        const mockAuthOptions = {
            challenge: "test-challenge",
            rpId: "test.frak.id",
            userVerification: "required" as const,
            timeout: 180000,
        };

        const mocks = {
            startAuthentication: vi.fn().mockResolvedValue(mockAuthResponse),
            generateAuthenticationOptions: vi
                .fn()
                .mockResolvedValue(mockAuthOptions),
            mockAuthResponse,
            mockAuthOptions,
        };

        await use(mocks);
    },

    /**
     * Provides mock browser APIs (Notification, ServiceWorker, PushManager)
     */
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
    mockBrowserAPIs: async ({}, use) => {
        const { vi } = await import("vitest");

        const originalWindow = global.window;
        const originalNavigator = global.navigator;
        const originalNotification = global.Notification;

        const mockNotificationAPI = (
            permission: "default" | "granted" | "denied"
        ) => {
            global.Notification = {
                requestPermission: vi.fn().mockResolvedValue(permission),
                permission,
            } as unknown as typeof Notification;
        };

        const mockServiceWorkerAPI = () => {
            const mockNavigator = Object.create(originalNavigator);
            Object.defineProperty(mockNavigator, "serviceWorker", {
                value: {
                    ready: Promise.resolve({
                        pushManager: {
                            getSubscription: vi.fn().mockResolvedValue(null),
                            subscribe: vi.fn().mockResolvedValue({}),
                        },
                    }),
                },
                writable: true,
            });
            global.navigator = mockNavigator as Navigator;
        };

        const mockPushManagerAPI = () => {
            Object.defineProperty(global.window, "PushManager", {
                value: {},
                writable: true,
            });
            global.ServiceWorkerRegistration = {
                prototype: { showNotification: vi.fn() },
            } as unknown as typeof ServiceWorkerRegistration;
        };

        const restoreBrowserAPIs = () => {
            global.window = originalWindow;
            global.navigator = originalNavigator;
            global.Notification = originalNotification;
        };

        await use({
            mockNotificationAPI,
            mockServiceWorkerAPI,
            mockPushManagerAPI,
            restoreBrowserAPIs,
        });

        // Auto restore after test
        restoreBrowserAPIs();
    },
});

/**
 * Type-aware hooks that have access to fixtures
 *
 * @example
 * ```ts
 * import { test } from '@/tests/fixtures';
 *
 * test.beforeEach(({ mockSession, mockAddress }) => {
 *     // Setup with typed fixtures
 *     sessionStore.getState().setSession(mockSession);
 *     vi.mocked(useAccount).mockReturnValue({ address: mockAddress });
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";

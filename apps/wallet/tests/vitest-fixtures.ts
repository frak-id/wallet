/**
 * Wallet app test fixtures extending base fixtures
 * Adds wallet-specific fixtures to the shared base fixtures
 */

import {
    type BaseTestFixtures,
    test as baseTest,
} from "@frak-labs/wallet-shared/tests/vitest-fixtures";

/**
 * Wallet-specific test fixtures (extends BaseTestFixtures)
 */
export type WalletTestFixtures = BaseTestFixtures & {
    /**
     * Fresh recovery store that auto-resets before and after each test
     */
    freshRecoveryStore: typeof import("@/module/stores/recoveryStore").recoveryStore;

    /**
     * Mock notification context with default values
     */
    mockNotificationContext: {
        isSubscribed: boolean;
        isInitialized: boolean;
        setIsSubscribed: ReturnType<typeof import("vitest").vi.fn>;
        setIsInitialized: ReturnType<typeof import("vitest").vi.fn>;
        adapter: {
            isSupported: ReturnType<typeof import("vitest").vi.fn>;
            getPermissionStatus: ReturnType<typeof import("vitest").vi.fn>;
            requestPermission: ReturnType<typeof import("vitest").vi.fn>;
            subscribe: ReturnType<typeof import("vitest").vi.fn>;
            unsubscribe: ReturnType<typeof import("vitest").vi.fn>;
            isSubscribed: ReturnType<typeof import("vitest").vi.fn>;
            initialize: ReturnType<typeof import("vitest").vi.fn>;
            showLocalNotification: ReturnType<typeof import("vitest").vi.fn>;
        };
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
 * Use this instead of the base test for wallet app tests
 *
 * @example
 * ```ts
 * import { test, expect } from '@/tests/vitest-fixtures';
 *
 * test('should use mock wallet', ({ mockAddress, mockBrowserAPIs }) => {
 *     // mockAddress from base fixtures
 *     // mockBrowserAPIs from wallet-specific fixtures
 *     mockBrowserAPIs.mockNotificationAPI('granted');
 *     expect(mockAddress).toBeDefined();
 * });
 * ```
 */
export const test = baseTest.extend<
    Pick<
        WalletTestFixtures,
        "freshRecoveryStore" | "mockNotificationContext" | "mockBrowserAPIs"
    >
>({
    /**
     * Provides a fresh recovery store that auto-resets after each test
     * Note: Only resets after use to avoid redundant overhead
     */
    freshRecoveryStore: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: typeof import("@/module/stores/recoveryStore").recoveryStore
        ) => Promise<void>
    ) => {
        const { recoveryStore } = await import("@/module/stores/recoveryStore");

        await use(recoveryStore);

        // Reset after use
        recoveryStore.getState().reset();
    },

    /**
     * Provides a mock notification context
     * Returns default mock values for testing notification features
     */
    mockNotificationContext: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (value: {
            isSubscribed: boolean;
            isInitialized: boolean;
            setIsSubscribed: ReturnType<typeof import("vitest").vi.fn>;
            setIsInitialized: ReturnType<typeof import("vitest").vi.fn>;
            adapter: {
                isSupported: ReturnType<typeof import("vitest").vi.fn>;
                getPermissionStatus: ReturnType<typeof import("vitest").vi.fn>;
                requestPermission: ReturnType<typeof import("vitest").vi.fn>;
                subscribe: ReturnType<typeof import("vitest").vi.fn>;
                unsubscribe: ReturnType<typeof import("vitest").vi.fn>;
                isSubscribed: ReturnType<typeof import("vitest").vi.fn>;
                initialize: ReturnType<typeof import("vitest").vi.fn>;
                showLocalNotification: ReturnType<
                    typeof import("vitest").vi.fn
                >;
            };
        }) => Promise<void>
    ) => {
        const { vi } = await import("vitest");
        const context = {
            isSubscribed: false,
            isInitialized: true,
            setIsSubscribed: vi.fn(),
            setIsInitialized: vi.fn(),
            adapter: {
                isSupported: vi.fn().mockReturnValue(false),
                getPermissionStatus: vi.fn().mockReturnValue("default"),
                requestPermission: vi.fn().mockResolvedValue("granted"),
                subscribe: vi.fn().mockResolvedValue(undefined),
                unsubscribe: vi.fn().mockResolvedValue(undefined),
                isSubscribed: vi.fn().mockResolvedValue(false),
                initialize: vi.fn().mockResolvedValue({ isSubscribed: false }),
                showLocalNotification: vi.fn().mockResolvedValue(undefined),
            },
        };

        await use(context);
    },

    /**
     * Provides mock browser APIs (Notification, ServiceWorker, PushManager)
     */
    mockBrowserAPIs: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (value: {
            mockNotificationAPI: (
                permission: "default" | "granted" | "denied"
            ) => void;
            mockServiceWorkerAPI: () => void;
            mockPushManagerAPI: () => void;
            restoreBrowserAPIs: () => void;
        }) => Promise<void>
    ) => {
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
 * import { test, beforeEach } from '@/tests/vitest-fixtures';
 *
 * beforeEach(({ mockSession, mockBrowserAPIs }) => {
 *     // Setup with typed fixtures from both base and wallet-specific
 *     sessionStore.getState().setSession(mockSession);
 *     mockBrowserAPIs.mockNotificationAPI('granted');
 * });
 * ```
 */
export const { beforeEach, afterEach, beforeAll, afterAll } = test;

/**
 * Re-export expect and other vitest utilities
 */
export { describe, expect, it, vi } from "vitest";

/**
 * Wallet app test fixtures extending base fixtures
 * Adds wallet-specific fixtures to the shared base fixtures
 */

import type {
    NotificationPermissionStatus,
    PushTokenPayload,
} from "@frak-labs/wallet-shared";
import {
    type BaseTestFixtures,
    test as baseTest,
} from "@frak-labs/wallet-shared/tests/vitest-fixtures";
import type { Mock } from "vitest";

/**
 * Wallet-specific test fixtures (extends BaseTestFixtures)
 */
export type WalletTestFixtures = BaseTestFixtures & {
    /**
     * Fresh recovery store that auto-resets before and after each test
     */
    freshRecoveryStore: typeof import("@/module/stores/recoveryStore").recoveryStore;

    /**
     * Mock notification adapter matching the NotificationAdapter shape
     */
    mockNotificationAdapter: {
        getPermissionStatus: Mock<() => Promise<NotificationPermissionStatus>>;
        requestPermission: Mock<() => Promise<NotificationPermissionStatus>>;
        getToken: Mock<() => Promise<PushTokenPayload | null>>;
        subscribe: Mock<() => Promise<PushTokenPayload>>;
        unsubscribe: Mock<() => Promise<void>>;
        openSettings: Mock<() => Promise<void>>;
        events: EventTarget;
        initPromise: Promise<void>;
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
        "freshRecoveryStore" | "mockNotificationAdapter" | "mockBrowserAPIs"
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
     * Provides a mock notification adapter
     * Returns default mock values matching the NotificationAdapter shape
     */
    mockNotificationAdapter: async (
        // biome-ignore lint/correctness/noEmptyPattern: Vitest requires object destructuring
        {},
        use: (
            value: WalletTestFixtures["mockNotificationAdapter"]
        ) => Promise<void>
    ) => {
        const { vi } = await import("vitest");
        const adapter: WalletTestFixtures["mockNotificationAdapter"] = {
            getPermissionStatus: vi
                .fn<() => Promise<NotificationPermissionStatus>>()
                .mockResolvedValue("prompt"),
            requestPermission: vi
                .fn<() => Promise<NotificationPermissionStatus>>()
                .mockResolvedValue("granted"),
            getToken: vi
                .fn<() => Promise<PushTokenPayload | null>>()
                .mockResolvedValue(null),
            subscribe: vi.fn<() => Promise<PushTokenPayload>>(),
            unsubscribe: vi
                .fn<() => Promise<void>>()
                .mockResolvedValue(undefined),
            openSettings: vi
                .fn<() => Promise<void>>()
                .mockResolvedValue(undefined),
            events: new EventTarget(),
            initPromise: Promise.resolve(),
        };

        await use(adapter);
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

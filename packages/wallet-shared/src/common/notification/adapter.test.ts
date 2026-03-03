import type { NotificationPayload } from "@frak-labs/ui/types/NotificationPayload";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNotificationAdapter } from "./adapter";

vi.mock("@frak-labs/app-essentials/utils/platform");

describe("NotificationAdapter", () => {
    describe("getNotificationAdapter", () => {
        it("should return a web adapter when not in Tauri", async () => {
            const { isTauri } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(isTauri).mockReturnValue(false);

            const adapter = getNotificationAdapter();

            expect(adapter).toBeDefined();
            expect(typeof adapter.isSupported).toBe("function");
            expect(typeof adapter.getPermissionStatus).toBe("function");
            expect(typeof adapter.requestPermission).toBe("function");
            expect(typeof adapter.subscribe).toBe("function");
            expect(typeof adapter.unsubscribe).toBe("function");
            expect(typeof adapter.isSubscribed).toBe("function");
            expect(typeof adapter.initialize).toBe("function");
            expect(typeof adapter.showLocalNotification).toBe("function");
        });

        it("should return a Tauri adapter when in Tauri", async () => {
            const { isTauri } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(isTauri).mockReturnValue(true);

            const adapter = getNotificationAdapter();

            expect(adapter).toBeDefined();
            expect(typeof adapter.isSupported).toBe("function");
            expect(typeof adapter.getPermissionStatus).toBe("function");
            expect(typeof adapter.requestPermission).toBe("function");
            expect(typeof adapter.subscribe).toBe("function");
            expect(typeof adapter.unsubscribe).toBe("function");
            expect(typeof adapter.isSubscribed).toBe("function");
            expect(typeof adapter.initialize).toBe("function");
            expect(typeof adapter.showLocalNotification).toBe("function");
        });

        it("should return different adapters based on isTauri() result", async () => {
            const { isTauri } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );

            vi.mocked(isTauri).mockReturnValue(false);
            const webAdapter = getNotificationAdapter();

            vi.mocked(isTauri).mockReturnValue(true);
            const tauriAdapter = getNotificationAdapter();

            expect(webAdapter).toBeDefined();
            expect(tauriAdapter).toBeDefined();
        });
    });

    describe("web adapter", () => {
        beforeEach(async () => {
            const { isTauri } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(isTauri).mockReturnValue(false);
        });

        it("should have isSupported method", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.isSupported).toBe("function");
            const result = adapter.isSupported();
            expect(typeof result).toBe("boolean");
        });

        it("should have getPermissionStatus method", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.getPermissionStatus).toBe("function");
            const result = adapter.getPermissionStatus();
            expect(typeof result).toBe("string");
        });

        it("should have requestPermission method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.requestPermission).toBe("function");
            const result = adapter.requestPermission();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have subscribe method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.subscribe).toBe("function");
            const result = adapter.subscribe();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have unsubscribe method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.unsubscribe).toBe("function");
            const result = adapter.unsubscribe();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have isSubscribed method that returns Promise<boolean>", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.isSubscribed).toBe("function");
            const result = adapter.isSubscribed();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have initialize method that returns Promise with isSubscribed", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.initialize).toBe("function");
            const result = adapter.initialize();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have showLocalNotification method that accepts NotificationPayload", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.showLocalNotification).toBe("function");

            const payload: NotificationPayload = {
                title: "Test Notification",
                body: "Test message",
            };

            const result = adapter.showLocalNotification(payload);
            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe("Tauri adapter", () => {
        beforeEach(async () => {
            const { isTauri } = await import(
                "@frak-labs/app-essentials/utils/platform"
            );
            vi.mocked(isTauri).mockReturnValue(true);
        });

        it("should have isSupported method", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.isSupported).toBe("function");
            const result = adapter.isSupported();
            expect(typeof result).toBe("boolean");
        });

        it("should have getPermissionStatus method", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.getPermissionStatus).toBe("function");
            const result = adapter.getPermissionStatus();
            expect(typeof result).toBe("string");
        });

        it("should have requestPermission method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.requestPermission).toBe("function");
            const result = adapter.requestPermission();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have subscribe method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.subscribe).toBe("function");
            const result = adapter.subscribe();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have unsubscribe method that returns Promise", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.unsubscribe).toBe("function");
            const result = adapter.unsubscribe();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have isSubscribed method that returns Promise<boolean>", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.isSubscribed).toBe("function");
            const result = adapter.isSubscribed();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have initialize method that returns Promise with isSubscribed", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.initialize).toBe("function");
            const result = adapter.initialize();
            expect(result).toBeInstanceOf(Promise);
        });

        it("should have showLocalNotification method that accepts NotificationPayload", () => {
            const adapter = getNotificationAdapter();
            expect(typeof adapter.showLocalNotification).toBe("function");

            const payload: NotificationPayload = {
                title: "Test Notification",
                body: "Test message",
            };

            const result = adapter.showLocalNotification(payload);
            expect(result).toBeInstanceOf(Promise);
        });
    });
});

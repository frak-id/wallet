import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationModel } from "./NotificationModel";

// Mock idb-keyval
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockCreateStore = vi.fn(() => "notification-store");

vi.mock("idb-keyval", () => ({
    get: mockGet,
    set: mockSet,
    createStore: mockCreateStore,
}));

describe("notificationStorage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("add", () => {
        it("should add notification when none exist", async () => {
            const { notificationStorage } = await import("./notifications");

            const mockNotification: NotificationModel = {
                id: "notif-1",
                title: "Test Notification",
                body: "Test message",
                timestamp: Date.now(),
            };

            mockGet.mockResolvedValue(null);
            mockSet.mockResolvedValue(undefined);

            await notificationStorage.add(mockNotification);

            expect(mockSet).toHaveBeenCalledWith(
                "notifications",
                [mockNotification],
                "notification-store"
            );
        });

        it("should append to existing notifications", async () => {
            const { notificationStorage } = await import("./notifications");

            const existing: NotificationModel = {
                id: "notif-1",
                title: "Old",
                body: "Old message",
                timestamp: Date.now() - 1000,
            };

            const newNotif: NotificationModel = {
                id: "notif-2",
                title: "New",
                body: "New message",
                timestamp: Date.now(),
            };

            mockGet.mockResolvedValue([existing]);
            mockSet.mockResolvedValue(undefined);

            await notificationStorage.add(newNotif);

            expect(mockSet).toHaveBeenCalledWith(
                "notifications",
                [existing, newNotif],
                "notification-store"
            );
        });
    });

    describe("getAll", () => {
        it("should return empty array when no notifications exist", async () => {
            const { notificationStorage } = await import("./notifications");

            mockGet.mockResolvedValue(null);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should return all notifications sorted by timestamp", async () => {
            const { notificationStorage } = await import("./notifications");

            const mockNotifications: NotificationModel[] = [
                {
                    id: "notif-1",
                    title: "Old",
                    body: "Old",
                    timestamp: 1000,
                },
                {
                    id: "notif-2",
                    title: "New",
                    body: "New",
                    timestamp: 3000,
                },
                {
                    id: "notif-3",
                    title: "Middle",
                    body: "Middle",
                    timestamp: 2000,
                },
            ];

            mockGet.mockResolvedValue(mockNotifications);

            const result = await notificationStorage.getAll();

            expect(result[0].timestamp).toBe(3000); // Newest first
            expect(result[1].timestamp).toBe(2000);
            expect(result[2].timestamp).toBe(1000);
        });

        it("should handle NotFoundError and return empty array", async () => {
            const { notificationStorage } = await import("./notifications");

            const notFoundError = new DOMException(
                "Store not found",
                "NotFoundError"
            );
            mockGet.mockRejectedValue(notFoundError);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should log and return empty array on unexpected errors", async () => {
            const { notificationStorage } = await import("./notifications");

            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const unexpectedError = new Error("Database error");
            mockGet.mockRejectedValue(unexpectedError);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get notifications:",
                unexpectedError
            );

            consoleErrorSpy.mockRestore();
        });
    });
});

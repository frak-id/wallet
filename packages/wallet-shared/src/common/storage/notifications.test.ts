import * as idbKeyval from "idb-keyval";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockNotification } from "../../test/factories";
import type { NotificationModel } from "./NotificationModel";
import { notificationStorage } from "./notifications";

// Mock idb-keyval
vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
    createStore: vi.fn(() => ({})), // Return a mock store object
}));

describe("notificationStorage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("add", () => {
        it("should add a notification to an empty store", async () => {
            const mockNotification = createMockNotification({
                id: "notif-1",
                title: "Test Notification",
                body: "Test message",
            });

            vi.mocked(idbKeyval.get).mockResolvedValue(undefined);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await notificationStorage.add(mockNotification);

            expect(idbKeyval.get).toHaveBeenCalledWith(
                "notifications",
                expect.anything()
            );
            expect(idbKeyval.set).toHaveBeenCalledWith(
                "notifications",
                [mockNotification],
                expect.anything()
            );
        });

        it("should add a notification to existing notifications", async () => {
            const existing: NotificationModel[] = [
                createMockNotification({
                    id: "notif-1",
                    timestamp: 1000,
                    title: "Existing",
                    body: "Existing message",
                }),
            ];

            const newNotification = createMockNotification({
                id: "notif-2",
                timestamp: 2000,
                title: "New",
                body: "New message",
            });

            vi.mocked(idbKeyval.get).mockResolvedValue(existing);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await notificationStorage.add(newNotification);

            // Check that set was called with the array containing both items
            const setCall = vi.mocked(idbKeyval.set).mock.calls[0];
            expect(setCall[0]).toBe("notifications");
            expect(setCall[1]).toHaveLength(2);
            expect(setCall[1]).toContainEqual(existing[0]);
            expect(setCall[1]).toContainEqual(newNotification);
        });

        it("should handle null as empty array", async () => {
            const mockNotification = createMockNotification({
                id: "notif-1",
                title: "Test",
                body: "Test",
            });

            vi.mocked(idbKeyval.get).mockResolvedValue(null);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await notificationStorage.add(mockNotification);

            expect(idbKeyval.set).toHaveBeenCalledWith(
                "notifications",
                [mockNotification],
                expect.anything()
            );
        });
    });

    describe("getAll", () => {
        it("should return all notifications sorted by timestamp (newest first)", async () => {
            const notifications: NotificationModel[] = [
                createMockNotification({
                    id: "notif-1",
                    timestamp: 1000,
                    title: "Old",
                    body: "Old message",
                }),
                createMockNotification({
                    id: "notif-2",
                    timestamp: 3000,
                    title: "Newest",
                    body: "Newest message",
                }),
                createMockNotification({
                    id: "notif-3",
                    timestamp: 2000,
                    title: "Middle",
                    body: "Middle message",
                }),
            ];

            // Return a copy to avoid mutation affecting test expectations
            vi.mocked(idbKeyval.get).mockResolvedValue([...notifications]);

            const result = await notificationStorage.getAll();

            // Verify sorted by timestamp descending (newest first)
            expect(result).toHaveLength(3);
            expect(result[0].id).toBe("notif-2"); // timestamp: 3000
            expect(result[1].id).toBe("notif-3"); // timestamp: 2000
            expect(result[2].id).toBe("notif-1"); // timestamp: 1000
        });

        it("should return empty array when no notifications exist", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue(undefined);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should return empty array when store returns null", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue(null);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should handle NotFoundError gracefully", async () => {
            const notFoundError = new DOMException(
                "Store not found",
                "NotFoundError"
            );
            vi.mocked(idbKeyval.get).mockRejectedValue(notFoundError);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should handle other errors gracefully and log them", async () => {
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});
            const unexpectedError = new Error("Unexpected error");
            vi.mocked(idbKeyval.get).mockRejectedValue(unexpectedError);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get notifications:",
                unexpectedError
            );

            consoleErrorSpy.mockRestore();
        });

        it("should return empty array for empty store", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue([]);

            const result = await notificationStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should sort notifications with same timestamp consistently", async () => {
            const notifications: NotificationModel[] = [
                createMockNotification({
                    id: "notif-1",
                    timestamp: 1000,
                    title: "First",
                    body: "First",
                }),
                createMockNotification({
                    id: "notif-2",
                    timestamp: 1000,
                    title: "Second",
                    body: "Second",
                }),
            ];

            vi.mocked(idbKeyval.get).mockResolvedValue(notifications);

            const result = await notificationStorage.getAll();

            // Both have same timestamp, order preserved from array
            expect(result).toHaveLength(2);
            expect(result[0].timestamp).toBe(1000);
            expect(result[1].timestamp).toBe(1000);
        });
    });
});

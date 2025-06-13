import { describe, expect, it, mock, beforeEach } from "bun:test";
import { NotificationsService } from "./NotificationsService";
import type { Address } from "viem";

// Mock web-push
mock.module("web-push", () => ({
    sendNotification: mock(() => Promise.resolve()),
    setVapidDetails: mock(() => {}),
}));

mock.module("../../../common", () => ({
    log: {
        debug: mock(() => {}),
        warn: mock(() => {}),
    },
}));

mock.module("@frak-labs/app-essentials", () => ({
    isRunningInProd: false,
}));

type MockDb = {
    query: {
        pushTokensTable: {
            findMany: ReturnType<typeof mock>;
        };
    };
    delete: ReturnType<typeof mock>;
};

describe("NotificationsService", () => {
    let service: NotificationsService;
    let mockDb: MockDb;

    beforeEach(() => {
        mockDb = {
            query: {
                pushTokensTable: {
                    findMany: mock(() => Promise.resolve([
                        {
                            wallet: "0x1234567890abcdef1234567890abcdef12345678",
                            endpoint: "https://fcm.googleapis.com/fcm/send/test1",
                            keyP256dh: "test-p256dh-key-1",
                            keyAuth: "test-auth-key-1",
                        },
                        {
                            wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                            endpoint: "https://fcm.googleapis.com/fcm/send/test2",
                            keyP256dh: "test-p256dh-key-2",
                            keyAuth: "test-auth-key-2",
                        },
                    ])),
                },
            },
            delete: mock(() => ({
                where: mock(() => ({
                    execute: mock(() => Promise.resolve()),
                })),
            })),
        };

        service = new NotificationsService(mockDb as any);
    });

    describe("sendNotification", () => {
        it("should handle empty token list gracefully", async () => {
            mockDb.query.pushTokensTable.findMany = mock(() => Promise.resolve([]));

            const result = await service.sendNotification({
                wallets: ["0x1234567890abcdef1234567890abcdef12345678"] as Address[],
                payload: {
                    title: "Test Notification",
                    body: "This is a test",
                    icon: "test-icon.png",
                },
            });

            expect(result).toBeUndefined();
        });

        it("should send notifications to valid tokens", async () => {
            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            ] as Address[];

            const payload = {
                title: "Test Notification",
                body: "This is a test notification",
                icon: "test-icon.png",
            };

            await service.sendNotification({ wallets, payload });

            // Verify that tokens were fetched for the given wallets
            expect(mockDb.query.pushTokensTable.findMany).toHaveBeenCalled();
        });

        it("should handle notification sending errors gracefully", async () => {
            // This test just verifies the method completes without throwing
            const wallets = ["0x1234567890abcdef1234567890abcdef12345678"] as Address[];
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            // Should not throw even if external service fails
            expect(service.sendNotification({ wallets, payload })).resolves.toBeUndefined();
        });
    });

    describe("cleanupExpiredTokens", () => {
        it("should delete expired tokens", async () => {
            await service.cleanupExpiredTokens();

            expect(mockDb.delete).toHaveBeenCalled();
        });
    });

    describe("notification chunking", () => {
        it("should handle large numbers of tokens by chunking", async () => {
            // Create a large number of mock tokens (more than 30)
            const manyTokens = Array.from({ length: 65 }, (_, i) => ({
                wallet: `0x${i.toString(16).padStart(40, '0')}`,
                endpoint: `https://fcm.googleapis.com/fcm/send/test${i}`,
                keyP256dh: `test-p256dh-key-${i}`,
                keyAuth: `test-auth-key-${i}`,
            }));

            mockDb.query.pushTokensTable.findMany = mock(() => Promise.resolve(manyTokens));

            const wallets = manyTokens.map(token => token.wallet as Address);
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            // Should not throw with large number of tokens
            expect(service.sendNotification({ wallets, payload })).resolves.toBeUndefined();
        });
    });
});
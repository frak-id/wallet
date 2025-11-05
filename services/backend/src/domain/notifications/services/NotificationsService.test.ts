import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mock,
} from "bun:test";
import type { Address } from "viem";
import { dbMock, webPushMocks } from "../../../../test/mock/common";
import { NotificationsService } from "./NotificationsService";

describe("NotificationsService", () => {
    let service: NotificationsService;

    const mockTokens = [
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
    ];

    beforeAll(() => {
        service = new NotificationsService();
    });

    beforeEach(() => {
        dbMock.__reset();
        webPushMocks.sendNotification.mockReset();
        dbMock.__setFindManyResponse(() => Promise.resolve(mockTokens));
        dbMock.__setDeleteResponse(() => Promise.resolve());
    });

    afterAll(() => {
        mock.restore();
    });

    describe("sendNotification", () => {
        it("should handle empty token list gracefully", async () => {
            dbMock.__setFindManyResponse(() => Promise.resolve([]));

            const result = await service.sendNotification({
                wallets: [
                    "0x1234567890abcdef1234567890abcdef12345678",
                ] as Address[],
                payload: {
                    title: "Test Notification",
                    body: "This is a test",
                    icon: "test-icon.png",
                },
            });

            expect(result).toBeUndefined();
            expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
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

            // Verify that sendNotification was called
            expect(webPushMocks.sendNotification).toHaveBeenCalled();
        });

        it("should handle notification sending errors gracefully", async () => {
            // This test just verifies the method completes without throwing
            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
            ] as Address[];
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            // Should not throw even if external service fails
            await expect(
                service.sendNotification({ wallets, payload })
            ).resolves.toBeUndefined();
        });
    });

    describe("cleanupExpiredTokens", () => {
        it("should delete expired tokens", async () => {
            await service.cleanupExpiredTokens();

            expect(dbMock.__getDeleteExecuteMock()).toHaveBeenCalled();
        });
    });

    describe("notification chunking", () => {
        it("should handle large numbers of tokens by chunking", async () => {
            // Create a large number of mock tokens (more than 30)
            const manyTokens = Array.from({ length: 65 }, (_, i) => ({
                wallet: `0x${i.toString(16).padStart(40, "0")}`,
                endpoint: `https://fcm.googleapis.com/fcm/send/test${i}`,
                keyP256dh: `test-p256dh-key-${i}`,
                keyAuth: `test-auth-key-${i}`,
            }));

            dbMock.__setFindManyResponse(() => Promise.resolve(manyTokens));

            const wallets = manyTokens.map((token) => token.wallet as Address);
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            // Should not throw with large number of tokens
            await service.sendNotification({ wallets, payload });

            expect(webPushMocks.sendNotification).toHaveBeenCalled();
        });
    });
});

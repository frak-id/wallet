import type { Address } from "viem";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { dbMock, fcmMocks, webPushMocks } from "../../../../test/mock/common";
import { FcmSender } from "./FcmSender";
import { NotificationsService } from "./NotificationsService";

describe("NotificationsService", () => {
    let service: NotificationsService;
    let fcmSender: FcmSender;

    const mockWebPushTokens = [
        {
            wallet: "0x1234567890abcdef1234567890abcdef12345678",
            type: "web-push" as const,
            endpoint: "https://fcm.googleapis.com/fcm/send/test1",
            keyP256dh: "test-p256dh-key-1",
            keyAuth: "test-auth-key-1",
            deviceId: null,
        },
        {
            wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            type: "web-push" as const,
            endpoint: "https://fcm.googleapis.com/fcm/send/test2",
            keyP256dh: "test-p256dh-key-2",
            keyAuth: "test-auth-key-2",
            deviceId: null,
        },
    ];

    const mockFcmTokens = [
        {
            wallet: "0x1234567890abcdef1234567890abcdef12345678",
            type: "fcm" as const,
            endpoint: "fcm-registration-token-1",
            keyP256dh: null,
            keyAuth: null,
            deviceId: "device-1",
        },
        {
            wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            type: "fcm" as const,
            endpoint: "fcm-registration-token-2",
            keyP256dh: null,
            keyAuth: null,
            deviceId: "device-2",
        },
    ];

    beforeAll(() => {
        fcmSender = new FcmSender();
        service = new NotificationsService(fcmSender);
    });

    beforeEach(() => {
        dbMock.__reset();
        webPushMocks.sendNotification.mockReset();
        fcmMocks.sendEachForMulticast.mockReset();
        fcmMocks.sendEachForMulticast.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            responses: [],
        });
        dbMock.__setFindManyResponse(() => Promise.resolve(mockWebPushTokens));
        dbMock.__setDeleteResponse(() => Promise.resolve());
    });

    afterAll(() => {
        vi.restoreAllMocks();
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

        it("should send web-push notifications for web-push tokens", async () => {
            dbMock.__setFindManyResponse(() =>
                Promise.resolve(mockWebPushTokens)
            );

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

            expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(2);
        });

        it("should send FCM notifications for FCM tokens", async () => {
            dbMock.__setFindManyResponse(() => Promise.resolve(mockFcmTokens));

            fcmMocks.sendEachForMulticast.mockResolvedValue({
                successCount: 2,
                failureCount: 0,
                responses: [
                    { success: true, messageId: "msg-1" },
                    { success: true, messageId: "msg-2" },
                ],
            });

            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            ] as Address[];

            const payload = {
                title: "Test Notification",
                body: "This is a test notification",
            };

            await service.sendNotification({ wallets, payload });

            expect(fcmMocks.sendEachForMulticast).toHaveBeenCalledTimes(1);
            expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
        });

        it("should dispatch to both senders when mixed tokens exist", async () => {
            dbMock.__setFindManyResponse(() =>
                Promise.resolve([...mockWebPushTokens, ...mockFcmTokens])
            );

            fcmMocks.sendEachForMulticast.mockResolvedValue({
                successCount: 2,
                failureCount: 0,
                responses: [
                    { success: true, messageId: "msg-1" },
                    { success: true, messageId: "msg-2" },
                ],
            });

            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            ] as Address[];

            const payload = {
                title: "Test Notification",
                body: "Both channels",
            };

            await service.sendNotification({ wallets, payload });

            expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(2);
            expect(fcmMocks.sendEachForMulticast).toHaveBeenCalledTimes(1);
        });

        it("should cleanup invalid FCM tokens after send", async () => {
            dbMock.__setFindManyResponse(() => Promise.resolve(mockFcmTokens));

            fcmMocks.sendEachForMulticast.mockResolvedValue({
                successCount: 1,
                failureCount: 1,
                responses: [
                    { success: true, messageId: "msg-1" },
                    {
                        success: false,
                        error: {
                            code: "messaging/registration-token-not-registered",
                            message: "Token not registered",
                        },
                    },
                ],
            });

            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
            ] as Address[];

            const payload = {
                title: "Test",
                body: "Cleanup test",
            };

            await service.sendNotification({ wallets, payload });

            expect(dbMock.__getDeleteExecuteMock()).toHaveBeenCalled();
        });

        it("should handle notification sending errors gracefully", async () => {
            const wallets = [
                "0x1234567890abcdef1234567890abcdef12345678",
            ] as Address[];
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

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
        it("should handle large numbers of web-push tokens by chunking", async () => {
            const manyTokens = Array.from({ length: 65 }, (_, i) => ({
                wallet: `0x${i.toString(16).padStart(40, "0")}`,
                type: "web-push" as const,
                endpoint: `https://fcm.googleapis.com/fcm/send/test${i}`,
                keyP256dh: `test-p256dh-key-${i}`,
                keyAuth: `test-auth-key-${i}`,
                deviceId: null,
            }));

            dbMock.__setFindManyResponse(() => Promise.resolve(manyTokens));

            const wallets = manyTokens.map((token) => token.wallet as Address);
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            await service.sendNotification({ wallets, payload });

            expect(webPushMocks.sendNotification).toHaveBeenCalled();
        });
    });
});

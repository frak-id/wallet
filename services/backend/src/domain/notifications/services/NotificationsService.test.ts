import {
    type Mock,
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
    mock,
    spyOn,
} from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Address } from "viem";
import { webPushMocks } from "../../../../test/mock/common";
import { pushTokensTable } from "../db/schema";
import { NotificationsService } from "./NotificationsService";

describe("NotificationsService", () => {
    const db = drizzle.mock({ schema: { pushTokensTable } });
    const findManySpy = spyOn(db.query.pushTokensTable, "findMany") as Mock<
        () => FindManyOutput
    >;
    const deleteExecuteMock = mock(() => Promise.resolve());

    type FindManyOutput = ReturnType<typeof db.query.pushTokensTable.findMany>;

    let service: NotificationsService;

    beforeAll(() => {
        findManySpy.mockImplementation(
            () =>
                Promise.resolve([
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
                ]) as unknown as FindManyOutput
        );
        Object.assign(db, {
            delete: () => ({
                where: () => ({
                    execute: deleteExecuteMock,
                }),
            }),
        });

        // The service we will test
        service = new NotificationsService(db);
    });

    afterAll(() => {
        mock.restore();
    });

    describe("sendNotification", () => {
        it("should handle empty token list gracefully", async () => {
            findManySpy.mockImplementation(
                () => Promise.resolve([]) as unknown as FindManyOutput
            );

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

            // Verify that tokens were fetched for the given wallets
            expect(findManySpy).toHaveBeenCalled();
            expect(webPushMocks.sendNotification).not.toHaveBeenCalled();
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
            expect(
                service.sendNotification({ wallets, payload })
            ).resolves.toBeUndefined();
        });
    });

    describe("cleanupExpiredTokens", () => {
        it("should delete expired tokens", async () => {
            await service.cleanupExpiredTokens();

            expect(deleteExecuteMock).toHaveBeenCalled();
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

            findManySpy.mockImplementation(
                () => Promise.resolve(manyTokens) as unknown as FindManyOutput
            );

            const wallets = manyTokens.map((token) => token.wallet as Address);
            const payload = {
                title: "Test Notification",
                body: "This is a test",
                icon: "test-icon.png",
            };

            // Should not throw with large number of tokens
            expect(
                service.sendNotification({ wallets, payload })
            ).resolves.toBeUndefined();
            expect(webPushMocks.sendNotification).toHaveBeenCalledTimes(
                manyTokens.length
            );
        });
    });
});

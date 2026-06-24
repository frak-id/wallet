import { beforeEach, describe, expect, it } from "vitest";
import { notificationsRoutes } from "../../../src/api/business/notifications";
// Import mocks and routes
import {
    JwtContextMock,
    notificationBroadcastRepositoryMocks,
    notificationOrchestratorMocks,
    notificationServiceMocks,
    resetMockBusinessSession,
    setMockBusinessSession,
} from "../../mock/common";

describe("Business Notifications Route API", () => {
    beforeEach(() => {
        // Reset all mocks before each test
        notificationServiceMocks.cleanupExpiredTokens.mockClear();
        notificationServiceMocks.sendNotification.mockClear();
        notificationOrchestratorMocks.sendPromotionalNotification.mockClear();
        resetMockBusinessSession();
        JwtContextMock.business.verify.mockClear();

        notificationBroadcastRepositoryMocks.create.mockClear();
        notificationBroadcastRepositoryMocks.updateScheduled.mockClear();
        notificationBroadcastRepositoryMocks.updateScheduled.mockResolvedValue(
            true as never
        );
        notificationBroadcastRepositoryMocks.listBroadcasts.mockClear();
        notificationBroadcastRepositoryMocks.deleteBroadcast.mockClear();
        notificationBroadcastRepositoryMocks.listBroadcasts.mockResolvedValue(
            [] as never
        );
        notificationBroadcastRepositoryMocks.deleteBroadcast.mockResolvedValue(
            true as never
        );
        notificationBroadcastRepositoryMocks.create.mockResolvedValue({
            id: "00000000-0000-0000-0000-000000000001",
        } as never);
    });

    describe("POST /send", () => {
        const validPayload = {
            title: "Test Notification",
            body: "This is a test notification",
        };

        const validTargetsWithWallets = {
            wallets: [
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222",
            ],
        };

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(401);

            expect(
                notificationServiceMocks.cleanupExpiredTokens
            ).not.toHaveBeenCalled();
            expect(
                notificationServiceMocks.sendNotification
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when targets are missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.title is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: {
                            body: "Test body",
                        },
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should return 422 when payload.body is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: validTargetsWithWallets,
                        payload: {
                            title: "Test title",
                        },
                    }),
                })
            );

            expect(response.status).toBe(422);
        });

        it("should handle targets.wallets with invalid addresses gracefully", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: {
                            wallets: ["not-a-valid-address", "0x123"],
                        },
                        payload: validPayload,
                    }),
                })
            );

            // Elysia Union validation does not reject invalid sub-member content,
            // so the handler processes the request with the provided addresses
            expect(response.status).toBe(200);
            expect(
                notificationOrchestratorMocks.sendPromotionalNotification
            ).toHaveBeenCalled();
        });

        it("should handle empty targets object gracefully", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId: "00000000-0000-0000-0000-000000000001",
                        targets: {},
                        payload: validPayload,
                    }),
                })
            );

            // Elysia Union validation does not reject empty targets,
            // handler falls through to filter branch returning empty wallets
            expect(response.status).toBe(200);
            expect(
                notificationOrchestratorMocks.sendPromotionalNotification
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    wallets: [],
                })
            );
        });

        it("should return 400 when request body is invalid JSON", async () => {
            // Act: Make POST request with invalid JSON
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/send", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: "{ invalid json",
                })
            );

            // Assert: Should return 400 bad request error
            expect(response.status).toBe(400);
        });
    });

    describe("POST /schedule", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";
        const validPayload = {
            title: "Test Notification",
            body: "This is a test notification",
        };
        const validTargets = {
            wallets: ["0x1111111111111111111111111111111111111111"],
        };
        const futureDate = () =>
            new Date(Date.now() + 60 * 60 * 1000).toISOString();

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: futureDate(),
                    }),
                })
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when scheduledAt is missing", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                    }),
                })
            );

            expect(response.status).toBe(422);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should return 400 when scheduledAt is in the past", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: new Date(
                            Date.now() - 60_000
                        ).toISOString(),
                    }),
                })
            );

            expect(response.status).toBe(400);
            expect(
                notificationBroadcastRepositoryMocks.create
            ).not.toHaveBeenCalled();
        });

        it("should create a scheduled broadcast and return its id", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/schedule", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-business-auth": "valid-token",
                    },
                    body: JSON.stringify({
                        merchantId,
                        targets: validTargets,
                        payload: validPayload,
                        scheduledAt: futureDate(),
                    }),
                })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.id).toBe("00000000-0000-0000-0000-000000000001");
            expect(
                notificationBroadcastRepositoryMocks.create
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    merchantId,
                    targets: validTargets,
                    scheduledAt: expect.any(Date),
                })
            );
        });
    });

    describe("PUT /broadcasts/:id", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";
        const scheduledId = "00000000-0000-0000-0000-0000000000aa";
        const futureDate = new Date(Date.now() + 60_000).toISOString();
        const validBody = {
            merchantId,
            targets: {
                wallets: ["0x1111111111111111111111111111111111111111"],
            },
            payload: { title: "Updated", body: "Updated body" },
            scheduledAt: futureDate,
        };

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${scheduledId}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(validBody),
                    }
                )
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.updateScheduled
            ).not.toHaveBeenCalled();
        });

        it("should return 400 when scheduledAt is in the past", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${scheduledId}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "x-business-auth": "valid-token",
                        },
                        body: JSON.stringify({
                            ...validBody,
                            scheduledAt: new Date(
                                Date.now() - 60_000
                            ).toISOString(),
                        }),
                    }
                )
            );

            expect(response.status).toBe(400);
            expect(
                notificationBroadcastRepositoryMocks.updateScheduled
            ).not.toHaveBeenCalled();
        });

        it("should return 404 when the scheduled notification does not exist", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.updateScheduled.mockResolvedValue(
                false as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${scheduledId}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "x-business-auth": "valid-token",
                        },
                        body: JSON.stringify(validBody),
                    }
                )
            );

            expect(response.status).toBe(404);
        });

        it("should update the scheduled notification and return 200", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.updateScheduled.mockResolvedValue(
                true as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${scheduledId}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "x-business-auth": "valid-token",
                        },
                        body: JSON.stringify(validBody),
                    }
                )
            );

            expect(response.status).toBe(200);
            expect(
                notificationBroadcastRepositoryMocks.updateScheduled
            ).toHaveBeenCalledWith(
                scheduledId,
                merchantId,
                expect.objectContaining({
                    payload: validBody.payload,
                    targets: validBody.targets,
                })
            );
        });
    });

    describe("GET /broadcasts", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts?merchantId=${merchantId}`
                )
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.listBroadcasts
            ).not.toHaveBeenCalled();
        });

        it("should return 422 when merchantId is missing", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            const response = await notificationsRoutes.handle(
                new Request("http://localhost/notifications/broadcasts", {
                    headers: { "x-business-auth": "valid-token" },
                })
            );

            expect(response.status).toBe(422);
        });

        it("should map broadcasts to push-history rows", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });

            notificationBroadcastRepositoryMocks.listBroadcasts.mockResolvedValue(
                [
                    {
                        id: "00000000-0000-0000-0000-0000000000aa",
                        merchantId,
                        payload: {
                            title: "Scheduled",
                            body: "Body",
                            data: { url: "https://x.example" },
                        },
                        targets: {
                            wallets: [
                                "0x1111111111111111111111111111111111111111",
                            ],
                        },
                        scheduledAt: new Date("2030-01-01T00:00:00.000Z"),
                        claimedAt: null,
                        createdAt: new Date("2025-01-01T00:00:00.000Z"),
                        sentCount: 0,
                        openedCount: 0,
                    },
                    {
                        id: "00000000-0000-0000-0000-0000000000bb",
                        merchantId,
                        payload: { title: "Delivered", body: "Body" },
                        targets: { filter: {} },
                        scheduledAt: null,
                        claimedAt: null,
                        createdAt: new Date("2025-02-01T00:00:00.000Z"),
                        sentCount: 10,
                        openedCount: 4,
                    },
                ] as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts?merchantId=${merchantId}`,
                    { headers: { "x-business-auth": "valid-token" } }
                )
            );

            expect(response.status).toBe(200);
            expect(
                notificationBroadcastRepositoryMocks.listBroadcasts
            ).toHaveBeenCalledWith(merchantId);

            const data = await response.json();
            expect(data).toEqual([
                {
                    id: "00000000-0000-0000-0000-0000000000aa",
                    title: "Scheduled",
                    status: "scheduled",
                    scheduledAt: new Date("2030-01-01T00:00:00.000Z").getTime(),
                    audienceLabel: "1 members",
                    sent: null,
                    opened: null,
                    payload: {
                        title: "Scheduled",
                        body: "Body",
                        url: "https://x.example",
                    },
                    target: {
                        wallets: ["0x1111111111111111111111111111111111111111"],
                    },
                    targetCount: 1,
                },
                {
                    id: "00000000-0000-0000-0000-0000000000bb",
                    title: "Delivered",
                    status: "sent",
                    scheduledAt: new Date("2025-02-01T00:00:00.000Z").getTime(),
                    audienceLabel: "All members",
                    sent: 10,
                    opened: 4,
                    payload: { title: "Delivered", body: "Body" },
                    target: { filter: {} },
                    targetCount: 10,
                },
            ]);
        });
    });

    describe("DELETE /broadcasts/:id", () => {
        const merchantId = "00000000-0000-0000-0000-000000000001";
        const broadcastId = "00000000-0000-0000-0000-0000000000aa";

        it("should return 401 when businessSession is missing", async () => {
            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${broadcastId}?merchantId=${merchantId}`,
                    { method: "DELETE" }
                )
            );

            expect(response.status).toBe(401);
            expect(
                notificationBroadcastRepositoryMocks.deleteBroadcast
            ).not.toHaveBeenCalled();
        });

        it("should return 404 when the broadcast does not exist", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.deleteBroadcast.mockResolvedValue(
                false as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${broadcastId}?merchantId=${merchantId}`,
                    {
                        method: "DELETE",
                        headers: { "x-business-auth": "valid-token" },
                    }
                )
            );

            expect(response.status).toBe(404);
        });

        it("should delete the broadcast and return 200", async () => {
            setMockBusinessSession({
                wallet: "0x1111111111111111111111111111111111111111",
            });
            notificationBroadcastRepositoryMocks.deleteBroadcast.mockResolvedValue(
                true as never
            );

            const response = await notificationsRoutes.handle(
                new Request(
                    `http://localhost/notifications/broadcasts/${broadcastId}?merchantId=${merchantId}`,
                    {
                        method: "DELETE",
                        headers: { "x-business-auth": "valid-token" },
                    }
                )
            );

            expect(response.status).toBe(200);
            expect(
                notificationBroadcastRepositoryMocks.deleteBroadcast
            ).toHaveBeenCalledWith(broadcastId, merchantId);

            const data = await response.json();
            expect(data).toEqual({ deleted: true });
        });
    });
});

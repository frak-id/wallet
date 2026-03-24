import { beforeEach, describe, expect, it, vi } from "vitest";
import { fcmMocks } from "../../../../test/mock/common";
import { FcmSender } from "./FcmSender";

describe("FcmSender", () => {
    let sender: FcmSender;

    beforeEach(() => {
        sender = new FcmSender();
        vi.spyOn(
            sender as unknown as { getAccessToken: () => Promise<string> },
            "getAccessToken"
        ).mockResolvedValue("mock-token");
        fcmMocks.reset();
    });

    describe("send", () => {
        it("should return empty array when FCM_SERVICE_ACCOUNT_JSON is not set", async () => {
            const original = process.env.FCM_SERVICE_ACCOUNT_JSON;
            delete process.env.FCM_SERVICE_ACCOUNT_JSON;

            const freshSender = new FcmSender();
            const result = await freshSender.send({
                tokens: ["token-1"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual([]);
            process.env.FCM_SERVICE_ACCOUNT_JSON = original;
        });

        it("should send to all tokens and return empty when all succeed", async () => {
            const result = await sender.send({
                tokens: ["token-1", "token-2"],
                payload: { title: "Test", body: "Test body" },
            });

            expect(result).toEqual([]);
            expect(fcmMocks.sendRequest).toHaveBeenCalledTimes(2);
            expect(fcmMocks.sendRequest).toHaveBeenCalledWith("token-1");
            expect(fcmMocks.sendRequest).toHaveBeenCalledWith("token-2");
        });

        it("should return UNREGISTERED tokens as invalid", async () => {
            fcmMocks.tokenErrors.set("bad-token", {
                error: {
                    code: 404,
                    message: "Requested entity was not found.",
                    status: "NOT_FOUND",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "UNREGISTERED",
                        },
                    ],
                },
            });

            const result = await sender.send({
                tokens: ["good-token", "bad-token"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual(["bad-token"]);
        });

        it("should return SENDER_ID_MISMATCH tokens as invalid", async () => {
            fcmMocks.tokenErrors.set("mismatched-token", {
                error: {
                    code: 403,
                    message: "SenderId mismatch",
                    status: "PERMISSION_DENIED",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "SENDER_ID_MISMATCH",
                        },
                    ],
                },
            });

            const result = await sender.send({
                tokens: ["mismatched-token"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual(["mismatched-token"]);
        });
    });

    describe("INVALID_ARGUMENT gating", () => {
        it("should treat INVALID_ARGUMENT as invalid when message references registration token", async () => {
            fcmMocks.tokenErrors.set("bad-format-token", {
                error: {
                    code: 400,
                    message:
                        "The registration token is not a valid FCM registration token",
                    status: "INVALID_ARGUMENT",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "INVALID_ARGUMENT",
                        },
                    ],
                },
            });

            const result = await sender.send({
                tokens: ["bad-format-token"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual(["bad-format-token"]);
        });

        it("should NOT treat INVALID_ARGUMENT as invalid when message is about payload", async () => {
            fcmMocks.tokenErrors.set("valid-token", {
                error: {
                    code: 400,
                    message:
                        "Invalid value at 'message.notification' (type.googleapis.com/...)",
                    status: "INVALID_ARGUMENT",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "INVALID_ARGUMENT",
                        },
                    ],
                },
            });

            const result = await sender.send({
                tokens: ["valid-token"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual([]);
        });
    });

    describe("mixed token results", () => {
        it("should return only invalid tokens from a mixed batch", async () => {
            fcmMocks.tokenErrors.set("dead-1", {
                error: {
                    code: 404,
                    message: "Requested entity was not found.",
                    status: "NOT_FOUND",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "UNREGISTERED",
                        },
                    ],
                },
            });
            fcmMocks.tokenErrors.set("dead-2", {
                error: {
                    code: 403,
                    message: "SenderId mismatch",
                    status: "PERMISSION_DENIED",
                    details: [
                        {
                            "@type":
                                "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                            errorCode: "SENDER_ID_MISMATCH",
                        },
                    ],
                },
            });

            const result = await sender.send({
                tokens: ["alive-1", "dead-1", "alive-2", "dead-2"],
                payload: { title: "Test", body: "Mixed" },
            });

            expect(result).toEqual(
                expect.arrayContaining(["dead-1", "dead-2"])
            );
            expect(result).toHaveLength(2);
            expect(fcmMocks.sendRequest).toHaveBeenCalledTimes(4);
        });
    });

    describe("error responses without details", () => {
        it("should not treat errors without details array as invalid tokens", async () => {
            fcmMocks.tokenErrors.set("server-error-token", {
                error: {
                    code: 500,
                    message: "Internal server error",
                    status: "INTERNAL",
                },
            });

            const result = await sender.send({
                tokens: ["server-error-token"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual([]);
        });
    });

    describe("OAuth token handling", () => {
        it("should handle OAuth token exchange failure gracefully", async () => {
            const freshSender = new FcmSender();
            vi.spyOn(
                freshSender as unknown as {
                    getAccessToken: () => Promise<string>;
                },
                "getAccessToken"
            ).mockRejectedValue(new Error("OAuth failed"));

            const result = await freshSender.send({
                tokens: ["token-1"],
                payload: { title: "Test", body: "Test" },
            });

            expect(result).toEqual([]);
        });
    });
});

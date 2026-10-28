import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { handleMessage } = vi.hoisted(() => ({ handleMessage: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/domain/instagram/context", () => ({
    InstagramContext: {
        services: { instagramVerification: { handleMessage } },
    },
}));

import { instagramWebhookRoutes } from "../../../src/api/external/instagram";
import { InstagramUnavailableError } from "../../../src/domain/instagram/services/InstagramVerificationService";

const APP_SECRET = "instagram-app-secret";
const VERIFY_TOKEN = "verify-me";
const BODY = JSON.stringify({
    object: "instagram",
    entry: [
        {
            id: "17841400000000001",
            time: 1,
            messaging: [
                {
                    sender: { id: "igsid-1" },
                    recipient: { id: "17841400000000001" },
                    timestamp: 1,
                    message: { mid: "m1", text: "K7Q2PX" },
                },
            ],
        },
    ],
});

const sign = (body: string, secret = APP_SECRET) =>
    `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

function post(body: string, signature?: string) {
    return instagramWebhookRoutes.handle(
        new Request("http://localhost/instagram/webhook", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(signature ? { "x-hub-signature-256": signature } : {}),
            },
            body,
        })
    );
}

function verify(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return instagramWebhookRoutes.handle(
        new Request(`http://localhost/instagram/webhook?${query}`)
    );
}

describe("Instagram webhook", () => {
    beforeEach(() => {
        vi.stubEnv("INSTAGRAM_APP_SECRET", APP_SECRET);
        vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", VERIFY_TOKEN);
        vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "token");
        handleMessage.mockReset();
        handleMessage.mockResolvedValue("linked");
    });
    afterEach(() => vi.unstubAllEnvs());

    describe("verification handshake", () => {
        it("echoes the challenge for the right verify token", async () => {
            const response = await verify({
                "hub.mode": "subscribe",
                "hub.verify_token": VERIFY_TOKEN,
                "hub.challenge": "1158201444",
            });

            expect(response.status).toBe(200);
            expect(await response.text()).toBe("1158201444");
        });

        it.each([
            ["a wrong verify token", { "hub.verify_token": "nope" }],
            ["another mode", { "hub.mode": "unsubscribe" }],
            ["no challenge", { "hub.challenge": "" }],
        ])("answers 403 to %s", async (_name, override) => {
            const response = await verify({
                "hub.mode": "subscribe",
                "hub.verify_token": VERIFY_TOKEN,
                "hub.challenge": "1158201444",
                ...override,
            });

            expect(response.status).toBe(403);
        });
    });

    describe("deliveries", () => {
        it("handles each text DM of a delivery signed by Meta", async () => {
            const response = await post(BODY, sign(BODY));

            expect(response.status).toBe(200);
            expect(handleMessage).toHaveBeenCalledWith({
                igsid: "igsid-1",
                text: "K7Q2PX",
            });
        });

        it.each([
            ["a signature made with another secret", sign(BODY, "other")],
            [
                "the signature of a body changed by one byte",
                sign(BODY.replace("K7Q2PX", "K7Q2PY")),
            ],
            ["no signature header", undefined],
        ])("answers 401 to %s, handling nothing", async (_name, signature) => {
            const response = await post(BODY, signature);

            expect(response.status).toBe(401);
            expect(handleMessage).not.toHaveBeenCalled();
        });

        it("answers 400 to a signed body that is not JSON", async () => {
            const response = await post("not json", sign("not json"));

            expect(response.status).toBe(400);
        });

        it("answers 500 when Meta cannot be asked, so the delivery comes back", async () => {
            handleMessage.mockRejectedValue(
                new InstagramUnavailableError("Meta did not answer")
            );

            const response = await post(BODY, sign(BODY));

            expect(response.status).toBe(500);
        });
    });

    it("is off without its secrets", async () => {
        vi.stubEnv("INSTAGRAM_APP_SECRET", "");

        const [delivery, handshake] = await Promise.all([
            post(BODY, sign(BODY)),
            verify({
                "hub.mode": "subscribe",
                "hub.verify_token": VERIFY_TOKEN,
                "hub.challenge": "1",
            }),
        ]);

        expect(delivery.status).toBe(404);
        expect(handshake.status).toBe(404);
        expect(handleMessage).not.toHaveBeenCalled();
    });
});

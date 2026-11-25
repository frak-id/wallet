import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";

const merchantMock = vi.hoisted(() => vi.fn());

vi.mock("./merchant", () => ({
    resolveMerchantId: vi.fn(),
}));

vi.mock("../utils/backendApi", () => ({
    backendApi: { business: { merchant: merchantMock } },
}));

import { log } from "./logger";
import { resolveMerchantId } from "./merchant";
import {
    connectSubscriptionProvider,
    disconnectSubscriptionProvider,
    getSubscriptionStatus,
} from "./subscriptions";

const TOKEN = "rc-secret-token-1234567890";
const context = {} as AuthenticatedContext;

function makeRequest(): Request {
    return new Request("https://test.myshopify.com/app", {
        headers: { authorization: "Bearer session-jwt" },
    });
}

function useSubscriptions(handlers: Record<string, unknown>) {
    merchantMock.mockReturnValue({ subscriptions: handlers });
}

function spyOnLogs() {
    return [
        vi.spyOn(log, "info").mockImplementation(() => undefined),
        vi.spyOn(log, "warn").mockImplementation(() => undefined),
        vi.spyOn(log, "error").mockImplementation(() => undefined),
    ];
}

function loggedText(spies: ReturnType<typeof spyOnLogs>): string {
    return JSON.stringify(
        spies.flatMap((spy) => spy.mock.calls),
        (_key, value) =>
            value instanceof Error ? `${value.message}\n${value.stack}` : value
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveMerchantId).mockResolvedValue("merchant-1");
});

describe("getSubscriptionStatus", () => {
    it("returns the backend status with the session headers", async () => {
        const status = {
            provider: "recharge",
            lastError: { at: "2026-11-25T10:00:00Z" },
        };
        const get = vi.fn().mockResolvedValue({ data: status, error: null });
        useSubscriptions({ get });

        const result = await getSubscriptionStatus(context, makeRequest());

        expect(result).toEqual(status);
        expect(merchantMock).toHaveBeenCalledWith({ merchantId: "merchant-1" });
        expect(get).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "session-jwt" },
        });
    });

    it("returns false without calling the backend when the merchant is unknown", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        expect(await getSubscriptionStatus(context, makeRequest())).toBeNull();
        expect(merchantMock).not.toHaveBeenCalled();
    });

    it.each([
        [401, "warn"],
        [403, "warn"],
        [500, "error"],
    ] as const)(
        "returns null and logs at the right level on %i",
        async (status, level) => {
            const [info, warn, error] = spyOnLogs();
            useSubscriptions({
                get: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { status } }),
            });

            expect(
                await getSubscriptionStatus(context, makeRequest())
            ).toBeNull();

            const expected = { info, warn, error }[level];
            expect(expected).toHaveBeenCalledWith(
                { merchantId: "merchant-1", status },
                "subscription status fetch failed"
            );
        }
    );

    it("returns false when the call throws", async () => {
        useSubscriptions({
            get: vi.fn().mockRejectedValue(new Error("network down")),
        });
        spyOnLogs();

        expect(await getSubscriptionStatus(context, makeRequest())).toBeNull();
    });
});

describe("connectSubscriptionProvider", () => {
    const params = { provider: "recharge", token: TOKEN } as const;

    it("sends the provider and token and reports connected on 204", async () => {
        const put = vi.fn().mockResolvedValue({ data: null, error: null });
        useSubscriptions({ put });

        const result = await connectSubscriptionProvider(
            context,
            makeRequest(),
            params
        );

        expect(result).toBe("connected");
        expect(put).toHaveBeenCalledWith(
            { provider: "recharge", token: TOKEN },
            { headers: { "X-Shopify-Session-Token": "session-jwt" } }
        );
    });

    it.each([
        [400, "invalid_token"],
        [409, "webhook_missing"],
        [502, "unavailable"],
        [401, "failed"],
        [403, "failed"],
        [422, "failed"],
        [500, "failed"],
    ])("maps status %i to %s", async (status, expected) => {
        spyOnLogs();
        useSubscriptions({
            put: vi.fn().mockResolvedValue({ data: null, error: { status } }),
        });

        const result = await connectSubscriptionProvider(
            context,
            makeRequest(),
            params
        );

        expect(result).toBe(expected);
    });

    it("returns failed without calling the backend when the merchant is unknown", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        const result = await connectSubscriptionProvider(
            context,
            makeRequest(),
            params
        );

        expect(result).toBe("failed");
        expect(merchantMock).not.toHaveBeenCalled();
    });

    it("returns failed when the call throws", async () => {
        spyOnLogs();
        useSubscriptions({
            put: vi.fn().mockRejectedValue(new Error("network down")),
        });

        const result = await connectSubscriptionProvider(
            context,
            makeRequest(),
            params
        );

        expect(result).toBe("failed");
    });

    it.each([400, 409, 502, 500])(
        "never logs the token on status %i",
        async (status) => {
            const spies = spyOnLogs();
            useSubscriptions({
                put: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { status } }),
            });

            await connectSubscriptionProvider(context, makeRequest(), params);

            expect(loggedText(spies)).not.toContain(TOKEN);
            expect(spies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
        }
    );

    it("never logs the token when the call throws", async () => {
        const spies = spyOnLogs();
        useSubscriptions({
            put: vi.fn().mockRejectedValue(new Error("socket hang up")),
        });

        await connectSubscriptionProvider(context, makeRequest(), params);

        expect(loggedText(spies)).not.toContain(TOKEN);
        expect(spies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
    });
});

describe("disconnectSubscriptionProvider", () => {
    it("returns true on 204", async () => {
        const del = vi.fn().mockResolvedValue({ data: null, error: null });
        useSubscriptions({ delete: del });

        const result = await disconnectSubscriptionProvider(
            context,
            makeRequest()
        );

        expect(result).toBe(true);
        expect(del).toHaveBeenCalledWith({
            headers: { "X-Shopify-Session-Token": "session-jwt" },
        });
    });

    it("returns false without calling the backend when the merchant is unknown", async () => {
        vi.mocked(resolveMerchantId).mockResolvedValue(null);

        expect(
            await disconnectSubscriptionProvider(context, makeRequest())
        ).toBe(false);
        expect(merchantMock).not.toHaveBeenCalled();
    });

    it.each([401, 403, 500])("returns false on status %i", async (status) => {
        spyOnLogs();
        useSubscriptions({
            delete: vi
                .fn()
                .mockResolvedValue({ data: null, error: { status } }),
        });

        expect(
            await disconnectSubscriptionProvider(context, makeRequest())
        ).toBe(false);
    });

    it("returns false when the call throws", async () => {
        spyOnLogs();
        useSubscriptions({
            delete: vi.fn().mockRejectedValue(new Error("network down")),
        });

        expect(
            await disconnectSubscriptionProvider(context, makeRequest())
        ).toBe(false);
    });
});

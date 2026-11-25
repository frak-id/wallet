import { afterEach, describe, expect, it, vi } from "vitest";
import { RechargeClient } from "./RechargeClient";

vi.mock("@backend-infrastructure/external/logger", () => ({
    log: { warn: vi.fn() },
}));

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("RechargeClient", () => {
    it("pins the API version and sends the merchant token", async () => {
        const fetchMock = stubFetch(json({ orders: [] }));

        await new RechargeClient().checkToken("tok");

        const [url, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe("https://api.rechargeapps.com/orders?limit=1");
        expect(init.headers).toMatchObject({
            "X-Recharge-Access-Token": "tok",
            "X-Recharge-Version": "2021-11",
        });
    });

    it.each([
        [200, "valid"],
        [401, "unauthorized"],
        [403, "unauthorized"],
        [500, "unavailable"],
    ] as const)("checks a token: HTTP %i is %s", async (status, expected) => {
        stubFetch(json({}, status));

        await expect(new RechargeClient().checkToken("tok")).resolves.toBe(
            expected
        );
    });

    it("finds an order by its Shopify id", async () => {
        const fetchMock = stubFetch(
            json({ orders: [{ id: 7, type: "CHECKOUT" }] })
        );

        const result = await new RechargeClient().findOrderByExternalId(
            "5551234",
            "tok"
        );

        expect(result).toEqual({
            kind: "found",
            value: { id: 7, type: "CHECKOUT" },
        });
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toBe(
            "https://api.rechargeapps.com/orders?external_order_id=5551234&limit=5"
        );
    });

    it("reports an order Recharge does not know yet as missing", async () => {
        stubFetch(json({ orders: [] }));

        await expect(
            new RechargeClient().findOrderByExternalId("1", "tok")
        ).resolves.toEqual({ kind: "missing" });
    });

    it("reports a rejected token as unauthorized", async () => {
        stubFetch(json({ error: "nope" }, 401));

        await expect(
            new RechargeClient().findOrderByExternalId("1", "tok")
        ).resolves.toEqual({ kind: "unauthorized" });
    });

    it("reports an unreachable Recharge as unavailable", async () => {
        stubFetch(new Error("network down"));

        await expect(
            new RechargeClient().getSubscription("9", "tok")
        ).resolves.toEqual({ kind: "unavailable" });
    });

    it("reports a throttled token with Recharge's retry delay", async () => {
        stubFetch(
            new Response("{}", {
                status: 429,
                headers: { "Retry-After": "5" },
            })
        );

        await expect(
            new RechargeClient().findOrderByExternalId("1", "tok")
        ).resolves.toEqual({ kind: "rate_limited", retryAfterMs: 5000 });
    });

    it("waits 2 seconds on a throttled call without a retry delay", async () => {
        stubFetch(json({}, 429));

        await expect(
            new RechargeClient().getSubscription("9", "tok")
        ).resolves.toEqual({ kind: "rate_limited", retryAfterMs: 2000 });
    });

    it("treats a throttled token check as unavailable", async () => {
        stubFetch(json({}, 429));

        await expect(new RechargeClient().checkToken("tok")).resolves.toBe(
            "unavailable"
        );
    });

    it("spaces calls on one token to stay under the leak rate", async () => {
        vi.useFakeTimers();
        const fetchMock = stubFetch(json({ orders: [] }));
        const client = new RechargeClient();

        const first = client.findOrderByExternalId("1", "tok");
        const second = client.findOrderByExternalId("2", "tok");
        const otherToken = client.findOrderByExternalId("3", "other");
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(500);
        await Promise.all([first, second, otherToken]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("paces a token again after its slot has passed", async () => {
        vi.useFakeTimers();
        const fetchMock = stubFetch(json({ orders: [] }));
        const client = new RechargeClient();

        await client.findOrderByExternalId("1", "tok");
        await vi.advanceTimersByTimeAsync(5_000);
        await client.findOrderByExternalId("2", "tok");
        const third = client.findOrderByExternalId("3", "tok");
        await vi.advanceTimersByTimeAsync(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(500);
        await third;
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("never keeps the raw token as a pacing key", async () => {
        stubFetch(json({ orders: [] }));
        const client = new RechargeClient();

        await client.findOrderByExternalId("1", "secret-token");

        const keys = [...Reflect.get(client, "nextSlot").keys()];
        expect(keys).toHaveLength(1);
        expect(keys[0]).not.toContain("secret-token");
    });

    it("reads a subscription's intervals", async () => {
        stubFetch(
            json({
                subscription: {
                    id: 9,
                    order_interval_frequency: 1,
                    charge_interval_frequency: 3,
                },
            })
        );

        const result = await new RechargeClient().getSubscription("9", "tok");

        expect(result).toMatchObject({
            kind: "found",
            value: { charge_interval_frequency: 3 },
        });
    });
});

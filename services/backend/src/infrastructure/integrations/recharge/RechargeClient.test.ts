import { afterEach, describe, expect, it, vi } from "vitest";
import { RECHARGE_API_VERSION, RechargeClient } from "./RechargeClient";

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
});

describe("RechargeClient", () => {
    it("pins the API version and sends the merchant token", async () => {
        const fetchMock = stubFetch(json({ orders: [] }));

        await new RechargeClient("https://recharge.test").checkToken("tok");

        const [url, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe("https://recharge.test/orders?limit=1");
        expect(init.headers).toMatchObject({
            "X-Recharge-Access-Token": "tok",
            "X-Recharge-Version": RECHARGE_API_VERSION,
        });
        expect(RECHARGE_API_VERSION).toBe("2021-11");
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

        const result = await new RechargeClient(
            "https://recharge.test"
        ).findOrderByExternalId("5551234", "tok");

        expect(result).toEqual({
            kind: "found",
            value: { id: 7, type: "CHECKOUT" },
        });
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toBe(
            "https://recharge.test/orders?external_order_id=5551234&limit=5"
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

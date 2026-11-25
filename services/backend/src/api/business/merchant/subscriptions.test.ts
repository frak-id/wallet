import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { merchantSubscriptionsRoutes } from "./subscriptions";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

describe("merchantSubscriptionsRoutes authorization", () => {
    it("declares requireMerchantAccess on all three routes", () => {
        const source = readFileSync(
            join(import.meta.dirname, "subscriptions.ts"),
            "utf8"
        );

        expect(source.match(/requireMerchantAccess:\s*true,/g)).toHaveLength(3);
        expect(source.match(/^\s*\.(get|put|delete)\(/gm)).toHaveLength(3);
    });

    const app = new Elysia().use(merchantSubscriptionsRoutes);

    it.each([
        ["GET", undefined],
        ["PUT", { provider: "recharge", token: "recharge-token" }],
        ["DELETE", undefined],
    ] as const)("rejects an anonymous %s", async (method, body) => {
        const response = await app.handle(
            new Request(`http://localhost/${MERCHANT_ID}/subscriptions`, {
                method,
                headers: { "content-type": "application/json" },
                ...(body ? { body: JSON.stringify(body) } : {}),
            })
        );

        expect(response.status).toBe(401);
    });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { merchantCampaignsRoutes } from "./campaigns";

const ROUTE_START = /^\s*\.(get|post|put|patch|delete|all|head|options)\(/;
const GUARD = /^\s*requireMerchantAccess:\s*true,$/m;

// Pinned: a route the regex stops matching fails here rather than silently
// dropping out of the guard check below.
const ROUTE_COUNTS: Record<string, number> = {
    "campaigns.ts": 9,
    "campaignDetails.ts": 1,
};

function routeBlocks(file: string): { method: string; body: string }[] {
    const lines = readFileSync(join(import.meta.dirname, file), "utf8").split(
        "\n"
    );
    const blocks: { method: string; body: string }[] = [];
    for (const line of lines) {
        const start = ROUTE_START.exec(line);
        if (start) {
            blocks.push({ method: start[1], body: "" });
            continue;
        }
        const current = blocks.at(-1);
        if (current) current.body += `${line}\n`;
    }
    return blocks;
}

describe.each(Object.keys(ROUTE_COUNTS))("%s authorization", (file) => {
    it("declares requireMerchantAccess on every route", () => {
        const blocks = routeBlocks(file);
        expect(blocks).toHaveLength(ROUTE_COUNTS[file]);

        const unguarded = blocks
            .filter((block) => !GUARD.test(block.body))
            .map((block) => block.method);
        expect(unguarded).toEqual([]);
    });
});

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const CAMPAIGN_ID = "3f1c8d92-5b7e-4a10-9c2d-6e8f0a1b2c3d";

describe("campaign mutation without a session", () => {
    const app = new Elysia().use(merchantCampaignsRoutes);

    function request(method: string, path: string, body?: unknown) {
        return app.handle(
            new Request(`http://localhost/${MERCHANT_ID}/campaigns${path}`, {
                method,
                headers: { "content-type": "application/json" },
                ...(body ? { body: JSON.stringify(body) } : {}),
            })
        );
    }

    it("rejects an anonymous update", async () => {
        const response = await request("PUT", `/${CAMPAIGN_ID}`, {
            name: "renamed",
        });
        expect(response.status).toBe(401);
    });

    it.each([
        ["POST", `/${CAMPAIGN_ID}/publish`],
        ["POST", `/${CAMPAIGN_ID}/pause`],
        ["DELETE", `/${CAMPAIGN_ID}`],
    ])("rejects an anonymous %s %s", async (method, path) => {
        const response = await request(method, path);
        expect(response.status).toBe(401);
    });
});

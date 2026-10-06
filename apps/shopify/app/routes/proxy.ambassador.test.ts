import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { SECRET } = vi.hoisted(() => ({ SECRET: "proxy-test-secret" }));

vi.mock("../shopify.server", async () => {
    await import("@shopify/shopify-app-react-router/server/adapters/node");
    const { ApiVersion, AppDistribution, LogSeverity, shopifyApp } =
        await import("@shopify/shopify-app-react-router/server");
    const { MemorySessionStorage } = await import(
        "@shopify/shopify-app-session-storage-memory"
    );
    const app = shopifyApp({
        apiKey: "proxy-test-key",
        apiSecretKey: SECRET,
        apiVersion: ApiVersion.April26,
        appUrl: "https://app.example",
        sessionStorage: new MemorySessionStorage(),
        distribution: AppDistribution.AppStore,
        logger: { level: LogSeverity.Error },
    });
    return { authenticate: app.authenticate };
});

import { loader } from "./proxy.ambassador";
import { loader as splatLoader } from "./proxy.ambassador.$";

const LIQUID = readFileSync(
    resolve(__dirname, "../../proxy/ambassador.liquid"),
    "utf-8"
);

function proxyRequest(path: string, sign: (message: string) => string) {
    const params: Record<string, string> = {
        shop: "shop.myshopify.com",
        logged_in_customer_id: "",
        path_prefix: "/apps/ambassador-dev",
        timestamp: String(Math.trunc(Date.now() / 1000)),
    };
    const message = Object.keys(params)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => `${key}=${params[key]}`)
        .join("");
    const query = new URLSearchParams({ ...params, signature: sign(message) });
    return new Request(`https://app.example${path}?${query}`);
}

const validSignature = (message: string) =>
    createHmac("sha256", SECRET).update(message).digest("hex");

function args(request: Request) {
    return { request, params: {}, context: {} } as Parameters<typeof loader>[0];
}

describe("proxy.ambassador loader", () => {
    it("serves the Liquid file as application/liquid for a signed request", async () => {
        const response = await loader(
            args(proxyRequest("/proxy/ambassador", validSignature))
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/liquid");
        expect(await response.text()).toBe(LIQUID);
    });

    it("serves the same file under the splat route", async () => {
        const response = await splatLoader(
            args(proxyRequest("/proxy/ambassador/anything", validSignature))
        );
        expect(await response.text()).toBe(LIQUID);
    });

    it("rejects a bad signature with a 400", async () => {
        const rejection = await loader(
            args(proxyRequest("/proxy/ambassador", () => "0".repeat(64)))
        ).catch((thrown: unknown) => thrown);
        expect(rejection).toBeInstanceOf(Response);
        expect((rejection as Response).status).toBe(400);
    });
});

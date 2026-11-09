import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { corsPlugin } from "../../src/infrastructure/macro/cors";

const app = new Elysia().use(corsPlugin).get("/ping", () => "pong");

describe("CORS", () => {
    it("lets a credentialed cross-origin preflight through", async () => {
        const response = await app.handle(
            new Request("http://localhost/ping", {
                method: "OPTIONS",
                headers: {
                    origin: "http://tauri.localhost",
                    "access-control-request-method": "GET",
                    "access-control-request-headers": "x-wallet-auth",
                },
            })
        );

        expect(response.headers.get("access-control-allow-origin")).toBe(
            "http://tauri.localhost"
        );
        expect(response.headers.get("access-control-allow-credentials")).toBe(
            "true"
        );
    });
});

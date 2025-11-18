import { Elysia } from "elysia";
import { beforeEach, describe, expect, it } from "vitest";

describe("Health Check API", () => {
    let app: Elysia;

    beforeEach(() => {
        // Create a minimal app with just the health endpoint for testing
        app = new Elysia().get("/health", () => ({
            status: "ok",
            hostname: process.env.HOSTNAME,
            stage: process.env.STAGE,
        }));
    });

    describe("GET /health", () => {
        it("should return health status", async () => {
            const response = await app.handle(
                new Request("http://localhost/health")
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toEqual({
                status: "ok",
                hostname: process.env.HOSTNAME,
                stage: process.env.STAGE,
            });
        });

        it("should have correct content type", async () => {
            const response = await app.handle(
                new Request("http://localhost/health")
            );

            expect(response.headers.get("content-type")).toContain(
                "application/json"
            );
        });

        it("should return status ok regardless of environment", async () => {
            // Test with different environment variables
            const originalHostname = process.env.HOSTNAME;
            const originalStage = process.env.STAGE;

            process.env.HOSTNAME = "test-host";
            process.env.STAGE = "test";

            const response = await app.handle(
                new Request("http://localhost/health")
            );
            const data = await response.json();

            expect(data.status).toBe("ok");
            expect(data.hostname).toBe("test-host");
            expect(data.stage).toBe("test");

            // Restore original values
            process.env.HOSTNAME = originalHostname;
            process.env.STAGE = originalStage;
        });
    });
});

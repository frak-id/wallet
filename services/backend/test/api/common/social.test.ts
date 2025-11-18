import { describe, expect, it } from "vitest";
import { socialRoute } from "../../../src/api/common/social";

describe("Social Route API", () => {
    describe("GET /social", () => {
        it("should redirect to URL when no user agent is present", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`
                )
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe(targetUrl);
        });

        it("should redirect to URL when user agent is not Meta browser", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
                        },
                    }
                )
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe(targetUrl);
        });

        it("should redirect using x-safari-https scheme for iOS Meta browsers", async () => {
            const targetUrl = "https://example.com/page?param=value";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent":
                                "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Instagram 123.0",
                        },
                    }
                )
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe(
                "x-safari-https://example.com/page?param=value"
            );
        });

        it("should redirect using x-safari-https scheme for iPad Meta browsers", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent":
                                "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) FBAN/FBIOS",
                        },
                    }
                )
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe(
                "x-safari-https://example.com/page"
            );
        });

        it("should return PDF headers for Android Meta browsers", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent":
                                "Mozilla/5.0 (Linux; Android 10) Instagram 123.0",
                        },
                    }
                )
            );

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe(
                "application/pdf"
            );
            expect(response.headers.get("content-disposition")).toBe(
                'inline; filename="dummy"'
            );
            expect(response.headers.get("content-transfer-encoding")).toBe(
                "binary"
            );
            expect(response.headers.get("accept-ranges")).toBe("bytes");
        });

        it("should detect Instagram as Meta browser", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent": "Instagram 123.0 (Android 10)",
                        },
                    }
                )
            );

            // Should trigger Meta browser handling (PDF response for Android)
            expect(response.headers.get("content-type")).toBe(
                "application/pdf"
            );
        });

        it("should detect Facebook (FBAN) as Meta browser", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent": "FBAN/FBIOS (Android 10)",
                        },
                    }
                )
            );

            // Should trigger Meta browser handling
            expect(response.headers.get("content-type")).toBe(
                "application/pdf"
            );
        });

        it("should detect Facebook (FBAV) as Meta browser", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent": "FBAV/123.0 (Android 10)",
                        },
                    }
                )
            );

            // Should trigger Meta browser handling
            expect(response.headers.get("content-type")).toBe(
                "application/pdf"
            );
        });

        it("should detect Facebook (facebook) as Meta browser", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent": "facebook (Android 10)",
                        },
                    }
                )
            );

            // Should trigger Meta browser handling
            expect(response.headers.get("content-type")).toBe(
                "application/pdf"
            );
        });

        it("should handle URLs with complex query parameters", async () => {
            const targetUrl =
                "https://example.com/page?foo=bar&baz=qux&test=123";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`
                )
            );

            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toBe(targetUrl);
        });

        it("should handle case-insensitive user agent matching", async () => {
            const targetUrl = "https://example.com/page";
            const response = await socialRoute.handle(
                new Request(
                    `http://localhost/social?u=${encodeURIComponent(targetUrl)}`,
                    {
                        headers: {
                            "user-agent": "INSTAGRAM 123.0 (IPHONE)",
                        },
                    }
                )
            );

            // Should detect as Meta browser and iOS
            expect(response.status).toBe(302);
            expect(response.headers.get("location")).toContain(
                "x-safari-https://"
            );
        });
    });
});

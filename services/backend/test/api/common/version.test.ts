import { describe, expect, it } from "vitest";
import {
    resolveMinVersions,
    versionRoutes,
} from "../../../src/api/common/version";
import "../../mock/common";

describe("resolveMinVersions", () => {
    it("disables both floors when nothing is configured", () => {
        expect(resolveMinVersions({})).toEqual({
            ios: "0.0.0",
            android: "0.0.0",
        });
    });

    it("sets one platform without touching the other", () => {
        expect(resolveMinVersions({ MIN_VERSION_IOS: "1.0.98" })).toEqual({
            ios: "1.0.98",
            android: "0.0.0",
        });
    });

    it("keeps each platform's own floor", () => {
        expect(
            resolveMinVersions({
                MIN_VERSION_IOS: "1.0.98",
                MIN_VERSION_ANDROID: "1.0.95",
            })
        ).toEqual({ ios: "1.0.98", android: "1.0.95" });
    });
});

describe("GET /version", () => {
    it("serves disabled floors with a short public cache when unset", async () => {
        const response = await versionRoutes.handle(
            new Request("http://localhost/version")
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe(
            "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
        );
        expect(await response.json()).toEqual({
            minVersion: { ios: "0.0.0", android: "0.0.0" },
        });
    });
});

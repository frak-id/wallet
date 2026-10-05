import { describe, expect, it } from "vitest";
import { missingScopes } from "./useOptionalScopes";

describe("missingScopes", () => {
    it("returns nothing when nothing is requested", () => {
        expect(missingScopes([], ["write_app_proxy"])).toEqual([]);
    });

    it("returns the requested scopes that are not granted", () => {
        expect(
            missingScopes(
                ["write_app_proxy", "write_online_store_navigation"],
                ["write_app_proxy", "read_products"]
            )
        ).toEqual(["write_online_store_navigation"]);
    });

    it("treats a granted write scope as granting its read scope", () => {
        expect(
            missingScopes(
                ["read_online_store_pages", "write_online_store_pages"],
                ["write_online_store_pages"]
            )
        ).toEqual([]);
    });

    it("never treats a granted read scope as granting its write scope", () => {
        expect(
            missingScopes(
                ["write_online_store_pages"],
                ["read_online_store_pages"]
            )
        ).toEqual(["write_online_store_pages"]);
    });

    it("returns every requested scope when none is granted", () => {
        expect(
            missingScopes(["write_app_proxy", "read_online_store_pages"], [])
        ).toEqual(["write_app_proxy", "read_online_store_pages"]);
    });
});

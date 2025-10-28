import { describe, expect, it } from "vitest";
import { ssoKey } from "./sso";

describe("ssoKey", () => {
    describe("params.bySearchParams", () => {
        it("should generate key with search params", () => {
            const searchParams = "foo=bar&baz=qux";
            const result = ssoKey.params.bySearchParams(searchParams);

            expect(result).toEqual([
                "sso",
                "params-decompression",
                searchParams,
            ]);
        });

        it("should generate key with empty string", () => {
            const result = ssoKey.params.bySearchParams("");

            expect(result).toEqual(["sso", "params-decompression", ""]);
        });

        it("should return array with exactly 3 elements", () => {
            const result = ssoKey.params.bySearchParams("test=123");

            expect(result).toHaveLength(3);
        });

        it("should include base keys as first two elements", () => {
            const result = ssoKey.params.bySearchParams("test=123");

            expect(result[0]).toBe("sso");
            expect(result[1]).toBe("params-decompression");
        });

        it("should be deterministic for same search params", () => {
            const searchParams = "id=123&redirect=home";
            const result1 = ssoKey.params.bySearchParams(searchParams);
            const result2 = ssoKey.params.bySearchParams(searchParams);

            expect(result1).toEqual(result2);
        });

        it("should generate different keys for different search params", () => {
            const result1 = ssoKey.params.bySearchParams("a=1");
            const result2 = ssoKey.params.bySearchParams("a=2");

            expect(result1).not.toEqual(result2);
        });

        it("should handle URL encoded params", () => {
            const searchParams = "redirect=https%3A%2F%2Fexample.com";
            const result = ssoKey.params.bySearchParams(searchParams);

            expect(result).toEqual([
                "sso",
                "params-decompression",
                searchParams,
            ]);
        });

        it("should handle complex query strings", () => {
            const searchParams =
                "foo=bar&baz=qux&redirect=https%3A%2F%2Fexample.com%2Fpath&id=123";
            const result = ssoKey.params.bySearchParams(searchParams);

            expect(result[2]).toBe(searchParams);
        });
    });

    describe("demo.login", () => {
        it("should return constant mutation key", () => {
            expect(ssoKey.demo.login).toEqual(["sso", "demo", "login"]);
        });

        it("should be an array with 3 elements", () => {
            expect(ssoKey.demo.login).toHaveLength(3);
        });

        it("should have sso as base key", () => {
            expect(ssoKey.demo.login[0]).toBe("sso");
        });

        it("should have demo as second element", () => {
            expect(ssoKey.demo.login[1]).toBe("demo");
        });

        it("should have login as third element", () => {
            expect(ssoKey.demo.login[2]).toBe("login");
        });

        it("should always return the same reference", () => {
            const ref1 = ssoKey.demo.login;
            const ref2 = ssoKey.demo.login;

            expect(ref1).toBe(ref2);
        });
    });
});

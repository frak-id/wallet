import { parseInstallSearch } from "@/module/install/params";
import { parseSharingSearch } from "@/module/sharing/params/search";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { searchParamsFromLocation } from "./search";

/**
 * The standalone entrypoints replace TanStack Router's search parsing with a
 * plain `URLSearchParams` read, so these tests pin the one thing that could
 * silently diverge: what the real SDK-issued URLs decode to.
 *
 * The URLs below are the shapes emitted by
 * `sdk/android/.../SharingPageUrl.kt`, `sdk/ios/.../SharingPageURL.swift` and
 * `wallet-shared/src/sharing/buildInstallUrl.ts` — change one there and this
 * should go red.
 */

describe("searchParamsFromLocation", () => {
    test("decodes percent-encoding and tolerates a missing query string", () => {
        expect(searchParamsFromLocation("?a=b%20c&d=1")).toEqual({
            a: "b c",
            d: "1",
        });
        expect(searchParamsFromLocation("")).toEqual({});
        expect(searchParamsFromLocation("?")).toEqual({});
    });

    test("last value wins on a repeated key, matching the router", () => {
        expect(searchParamsFromLocation("?m=first&m=second")).toEqual({
            m: "second",
        });
    });
});

describe("standalone /sharing search", () => {
    const nativeLaunch =
        "?embed=native&merchantId=merchant-1&clientId=client-1" +
        "&returnScheme=frak-id.frak.demo&sid=session-9&sdkVersion=1.2.3" +
        "&appName=Acme&logoUrl=https%3A%2F%2Fcdn.example%2Flogo.png";

    test("decodes an Android/iOS sheet launch", () => {
        expect(
            parseSharingSearch(searchParamsFromLocation(nativeLaunch))
        ).toMatchObject({
            embed: "native",
            merchantId: "merchant-1",
            clientId: "client-1",
            returnScheme: "frak-id.frak.demo",
            sid: "session-9",
            sdkVersion: "1.2.3",
            appName: "Acme",
            logoUrl: "https://cdn.example/logo.png",
        });
    });

    test("decodes a warm (preloaded) launch", () => {
        const search = parseSharingSearch(
            searchParamsFromLocation(`${nativeLaunch}&state=warm`)
        );
        expect(search.state).toBe("warm");
    });

    test("still rejects a return scheme that is not ours", () => {
        const search = parseSharingSearch(
            searchParamsFromLocation("?returnScheme=some-banking-app")
        );
        expect(search.returnScheme).toBeUndefined();
    });

    test("accepts `products` as the JSON array the native SDKs send", () => {
        // The native builders document this param as "pre-serialised JSON";
        // the router used to JSON-parse it for us, here it stays a string.
        const products = JSON.stringify([
            { title: "A product", link: "https://example.com/p/1" },
        ]);
        const search = parseSharingSearch(
            searchParamsFromLocation(
                `?products=${encodeURIComponent(products)}`
            )
        );
        expect(search.products).toHaveLength(1);
        expect(search.products?.[0]).toMatchObject({ title: "A product" });
    });

    test("a numeric-looking merchant id stays a string", () => {
        // The router would JSON-parse this into a `number`, which the `str`
        // codec then drops. URLSearchParams cannot, so the standalone page is
        // strictly more permissive here — never less.
        const search = parseSharingSearch(searchParamsFromLocation("?sid=42"));
        expect(search.sid).toBe("42");
    });
});

describe("standalone /install search", () => {
    test("decodes the link `buildInstallUrl` produces", () => {
        expect(
            parseInstallSearch(
                searchParamsFromLocation("?m=merchant-1&a=client-1")
            )
        ).toEqual({
            m: "merchant-1",
            a: "client-1",
            checkoutToken: undefined,
            p: undefined,
            embed: undefined,
            returnScheme: undefined,
            sid: undefined,
        });
    });

    test("decodes a native web-view launch", () => {
        expect(
            parseInstallSearch(
                searchParamsFromLocation(
                    "?embed=native&m=merchant-1&a=client-1" +
                        "&returnScheme=frak-id.frak.demo&sid=session-9&p=proof-abc"
                )
            )
        ).toEqual({
            m: "merchant-1",
            a: "client-1",
            checkoutToken: undefined,
            p: "proof-abc",
            embed: "native",
            returnScheme: "frak-id.frak.demo",
            sid: "session-9",
        });
    });

    test("still rejects an arbitrary return scheme", () => {
        const search = parseInstallSearch(
            searchParamsFromLocation("?returnScheme=some-banking-app")
        );
        expect(search.returnScheme).toBeUndefined();
    });

    test("decodes the token-only link a Shopify buyer lands on", () => {
        expect(
            parseInstallSearch(
                searchParamsFromLocation("?m=merchant-1&checkoutToken=tok%2F1")
            )
        ).toEqual({
            m: "merchant-1",
            a: undefined,
            checkoutToken: "tok/1",
            p: undefined,
            embed: undefined,
            returnScheme: undefined,
            sid: undefined,
        });
    });
});

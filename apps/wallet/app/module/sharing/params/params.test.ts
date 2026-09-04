import { compressJsonToB64 } from "@frak-labs/core-sdk";
import { parseSearchWith } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { parseSharingFragment } from "./fragment";
import { parseSharingSearch } from "./search";

// The router runs search values through JSON, so `?sid=1738147200000` arrives as a number.
const parseSearch = parseSearchWith(JSON.parse);
const fromUrl = (query: string) =>
    parseSharingSearch(parseSearch(query) as Record<string, unknown>);

describe("query params", () => {
    it("ignores params it does not know", () => {
        const result = parseSharingSearch({
            merchantId: "m1",
            somethingFromAFutureSdk: "value",
        });

        expect(result.merchantId).toBe("m1");
        expect(result).not.toHaveProperty("somethingFromAFutureSdk");
    });

    it("accepts sdkVersion so old binaries stay identifiable", () => {
        expect(parseSharingSearch({ sdkVersion: "0.1.0" }).sdkVersion).toBe(
            "0.1.0"
        );
        expect(parseSharingSearch({}).sdkVersion).toBeUndefined();
        expect(fromUrl("?sdkVersion=0.1").sdkVersion).toBe("0.1");
    });

    it("reads embed as an enum, not a flag", () => {
        expect(fromUrl("?embed=native").embed).toBe("native");
        expect(fromUrl("?embed=1").embed).toBeUndefined();
        expect(fromUrl("?embed=whatever").embed).toBeUndefined();
        expect(parseSharingSearch({}).embed).toBeUndefined();
    });

    it("reads state and view as enums", () => {
        expect(fromUrl("?state=warm").state).toBe("warm");
        expect(fromUrl("?state=live").state).toBe("live");
        expect(fromUrl("?state=nonsense").state).toBeUndefined();

        expect(fromUrl("?view=confirmation").view).toBe("confirmation");
        expect(fromUrl("?view=share").view).toBe("share");
        expect(parseSharingSearch({}).view).toBeUndefined();
    });

    it("keeps an all-digit sid, which parses as a number", () => {
        expect(fromUrl("?sid=1738147200000").sid).toBe("1738147200000");
        expect(fromUrl("?sid=abc123").sid).toBe("abc123");
    });

    it("keeps an all-digit share override, which parses as a number", () => {
        expect(fromUrl("?shareTitle=2024").shareTitle).toBe("2024");
        expect(fromUrl("?shareText=2024").shareText).toBe("2024");
    });

    it("drops a returnScheme that is not a valid frak scheme", () => {
        expect(fromUrl("?returnScheme=frak-acme").returnScheme).toBe(
            "frak-acme"
        );
        expect(
            fromUrl("?returnScheme=some-banking-app").returnScheme
        ).toBeUndefined();
    });

    it("drops a redirectUrl that is not https", () => {
        expect(
            parseSharingSearch({ redirectUrl: "https://shop.example/cart" })
                .redirectUrl
        ).toBe("https://shop.example/cart");
        expect(
            parseSharingSearch({ redirectUrl: "javascript:alert(1)" })
                .redirectUrl
        ).toBeUndefined();
    });

    it("accepts a seeded reward headline but not arbitrary text", () => {
        expect(parseSharingSearch({ seedReward: "12,50 €" }).seedReward).toBe(
            "12,50 €"
        );
        expect(
            parseSharingSearch({ seedReward: "<img src=x>" }).seedReward
        ).toBeUndefined();
        expect(parseSharingSearch({}).seedReward).toBeUndefined();
    });

    it("no longer reads attribution from the URL", () => {
        const result = parseSharingSearch({
            attribution: { utmSource: "x" },
            utm_source: "newsletter",
            ref: "someone",
        });
        expect(result).not.toHaveProperty("attribution");
        expect(result).not.toHaveProperty("utm_source");
        expect(result).not.toHaveProperty("ref");
    });
});

describe("embed", () => {
    it("is the one marker of a host-embedded page", () => {
        expect(fromUrl("?embed=native").embed).toBe("native");
    });

    it("rejects any other value rather than guessing", () => {
        expect(fromUrl("?embed=iframe").embed).toBeUndefined();
        expect(fromUrl("?embed=1").embed).toBeUndefined();
        expect(fromUrl("?embed=NATIVE").embed).toBeUndefined();
        expect(fromUrl("?merchantId=m1").embed).toBeUndefined();
    });

    it("is not implied by returnScheme", () => {
        const result = fromUrl("?returnScheme=frak-com.acme.app");
        expect(result.returnScheme).toBe("frak-com.acme.app");
        expect(result.embed).toBeUndefined();
    });
});

describe("products, in both encodings", () => {
    const products = [{ title: "Kettle", link: "https://acme.example/k" }];

    it("accepts the raw-JSON encoding the Shopify extension sends", () => {
        const query = `?products=${encodeURIComponent(JSON.stringify(products))}`;
        expect(fromUrl(query).products).toEqual(products);
    });

    it("accepts the b64-compressed encoding", () => {
        const query = `?products=${encodeURIComponent(compressJsonToB64(products))}`;
        expect(fromUrl(query).products).toEqual(products);
    });

    it("sanitizes rather than casting", () => {
        const result = parseSharingSearch({
            products: [
                { title: "Safe", link: "https://acme.example/s" },
                { title: "Unsafe", link: "javascript:alert(1)" },
                { title: "" },
            ],
        });
        expect(result.products).toEqual([
            { title: "Safe", link: "https://acme.example/s" },
            { title: "Unsafe" },
        ]);
    });

    it("drops a list that sanitizes to nothing", () => {
        expect(
            parseSharingSearch({ products: [{ title: "" }] }).products
        ).toBeUndefined();
        expect(
            parseSharingSearch({ products: "not-json" }).products
        ).toBeUndefined();
    });
});

describe("share overrides", () => {
    it("accepts a title and text within their caps", () => {
        expect(
            parseSharingSearch({ shareTitle: "Kettle deal" }).shareTitle
        ).toBe("Kettle deal");
        expect(
            parseSharingSearch({ shareText: "Grab it before it's gone" })
                .shareText
        ).toBe("Grab it before it's gone");
    });

    it("clips a title or text past its cap instead of dropping it", () => {
        const title = parseSharingSearch({
            shareTitle: "a".repeat(121),
        }).shareTitle;
        expect(title).toHaveLength(120);
        expect(title?.endsWith("…")).toBe(true);
        expect(
            parseSharingSearch({ shareTitle: "a".repeat(120) }).shareTitle
        ).toBe("a".repeat(120));

        const text = parseSharingSearch({
            shareText: "a".repeat(281),
        }).shareText;
        expect(text).toHaveLength(280);
        expect(text?.endsWith("…")).toBe(true);
        expect(
            parseSharingSearch({ shareText: "a".repeat(280) }).shareText
        ).toBe("a".repeat(280));
    });

    it("drops an empty title or text rather than keeping a blank override", () => {
        expect(
            parseSharingSearch({ shareTitle: "" }).shareTitle
        ).toBeUndefined();
        expect(parseSharingSearch({ shareText: "" }).shareText).toBeUndefined();
    });

    it("accepts an https image and rejects everything else", () => {
        expect(
            parseSharingSearch({
                shareImage: "https://cdn.example.com/p.png",
            }).shareImage
        ).toBe("https://cdn.example.com/p.png");
        expect(
            parseSharingSearch({ shareImage: "http://cdn.example.com/p.png" })
                .shareImage
        ).toBeUndefined();
        expect(
            parseSharingSearch({ shareImage: "not-a-url" }).shareImage
        ).toBeUndefined();
    });

    it("are absent by default", () => {
        const result = parseSharingSearch({});
        expect(result.shareTitle).toBeUndefined();
        expect(result.shareText).toBeUndefined();
        expect(result.shareImage).toBeUndefined();
    });
});

describe("activation fragment", () => {
    it("reads the per-tap params a warmed page is still missing", () => {
        const activation = parseSharingFragment(
            "#link=https%3A%2F%2Facme.example%2Fkettle&seedReward=12%20%E2%82%AC&sid=s1&state=live"
        );
        expect(activation).toMatchObject({
            link: "https://acme.example/kettle",
            seedReward: "12 €",
            sid: "s1",
            state: "live",
        });
    });

    it("clears the warm state, which is what makes the view event fire", () => {
        expect(parseSharingFragment("#state=live&sid=s1")?.state).toBe("live");
        expect(parseSharingFragment("#state=warm")?.state).toBe("warm");
    });

    it("clears the warm state even when the host forgot to say so", () => {
        expect(parseSharingFragment("#sid=s1")?.state).toBe("live");
    });

    it("omits keys the fragment does not carry", () => {
        const activation = parseSharingFragment("#sid=s1");
        expect(activation).not.toHaveProperty("logoUrl");
        expect(activation).not.toHaveProperty("link");
        expect(activation).not.toHaveProperty("products");
    });

    it("refuses query-only params, whatever the fragment claims", () => {
        const activation = parseSharingFragment("#embed=native&sid=s1");
        expect(activation).not.toHaveProperty("embed");
        expect(activation?.sid).toBe("s1");
    });

    it("carries a per-request logo override", () => {
        expect(
            parseSharingFragment("#logoUrl=https%3A%2F%2Facme.example%2Fl.png")
                ?.logoUrl
        ).toBe("https://acme.example/l.png");
    });

    it("parses the product list, in both encodings", () => {
        const products = [{ title: "Kettle", link: "https://acme.example/k" }];
        expect(
            parseSharingFragment(
                `#products=${encodeURIComponent(JSON.stringify(products))}`
            )?.products
        ).toEqual(products);
        expect(
            parseSharingFragment(
                `#products=${encodeURIComponent(compressJsonToB64(products))}`
            )?.products
        ).toEqual(products);
    });

    it("drops a garbled product list without losing the activation", () => {
        const activation = parseSharingFragment("#products=not-json&sid=s1");
        expect(activation?.products).toBeUndefined();
        expect(activation?.sid).toBe("s1");
    });

    it("sanitizes exactly as the query string does", () => {
        expect(
            parseSharingFragment("#seedReward=%3Cimg%20src%3Dx%3E")
        ).not.toHaveProperty("seedReward");
        expect(
            parseSharingFragment("#seedReward=12%20%E2%82%AC")?.seedReward
        ).toBe(fromUrl("?seedReward=12%20%E2%82%AC").seedReward);
    });

    it("omits a rejected value rather than nulling it", () => {
        const activation = parseSharingFragment(
            "#seedReward=%3Cimg%20src%3Dx%3E&sid=s1"
        );
        expect(activation).not.toHaveProperty("seedReward");
        expect(activation?.sid).toBe("s1");
    });

    it("treats an empty fragment as no activation at all", () => {
        expect(parseSharingFragment("")).toBeNull();
        expect(parseSharingFragment("#")).toBeNull();
    });

    it("carries the share overrides, exactly as the query string does", () => {
        const activation = parseSharingFragment(
            "#shareTitle=Kettle%20deal&shareText=Grab%20it&shareImage=https%3A%2F%2Fcdn.example.com%2Fp.png&sid=s1"
        );
        expect(activation).toMatchObject({
            shareTitle: "Kettle deal",
            shareText: "Grab it",
            shareImage: "https://cdn.example.com/p.png",
        });
    });

    it("omits a rejected share override rather than nulling it", () => {
        const activation = parseSharingFragment(
            "#shareImage=http://x/p.png&sid=s1"
        );
        expect(activation).not.toHaveProperty("shareImage");
        expect(activation?.sid).toBe("s1");
    });

    it("clips an over-long override arriving by fragment", () => {
        const activation = parseSharingFragment(
            `#shareTitle=${"a".repeat(121)}&sid=s1`
        );
        expect(activation?.shareTitle).toHaveLength(120);
        expect(activation?.sid).toBe("s1");
    });
});

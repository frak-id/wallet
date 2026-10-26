/**
 * Generates `src/context/fixtures/golden-sharing-links.json`: share-link building and `fCtx` parsing.
 * Deterministic: hardcoded inputs, no clock, no `generatedAt`. Run: `bun run fixtures:generate:links`.
 * A built link is compared DECODED, never byte-for-byte (see `decodeLink`); `expected: null` means refuse.
 * Native ports must run `mergeAttribution` then `FrakContextManager.update` equivalents on `input`.
 * Consumers: `src/context/goldenSharingLinks.test.ts`, native SDKs via `@frak-labs/core-sdk/context/sharing-links-fixtures`.
 */

import { FrakContextManager } from "../src/context/frakContext";
import { mergeAttribution } from "../src/context/mergeAttribution";
import type {
    AttributionDefaults,
    AttributionParams,
    FrakContext,
    FrakContextV2,
} from "../src/types";

const CONTEXT: FrakContextV2 = {
    v: 2,
    m: "550e8400-e29b-41d4-a716-446655440000",
    t: 1_709_654_400,
    c: "550e8400-e29b-41d4-a716-446655440001",
};

/** The `fCtx` value of {@link CONTEXT}, so parse inputs are readable literals. */
const TOKEN = "ElUOhADim0HUpxZEZlVEAABl50GAVQ6EAOKbQdSnFkRmVUQAAQ";

/** The comparable form of a built link. */
type DecodedLink = {
    /** Before the first `?` or `#`; scheme and authority lowercased, `/` appended when the path is empty. */
    base: string;
    /** Ordered `[key, value]`; `&` then first `=` (no `=` is ""), `+` is a space, percent-decoded, empty segments skipped. */
    query: [string, string][];
    /** From `#` inclusive, or "". */
    fragment: string;
};

type BuildInput = {
    context: FrakContextV2;
    baseUrl: string;
    perCall?: AttributionParams;
    defaults?: AttributionDefaults;
    productUtmContent?: string;
};

type BuildFixture = {
    name: string;
    description: string;
    kind: "build";
    input: BuildInput;
    expected: DecodedLink | null;
};

type ParseFixture = {
    name: string;
    description: string;
    kind: "parse";
    input: { url: string };
    expected: FrakContext | null;
};

function decodeComponent(raw: string): string {
    return decodeURIComponent(raw.replaceAll("+", " "));
}

function decodeLink(link: string): DecodedLink {
    const hashAt = link.indexOf("#");
    const fragment = hashAt === -1 ? "" : link.slice(hashAt);
    const beforeFragment = hashAt === -1 ? link : link.slice(0, hashAt);

    const queryAt = beforeFragment.indexOf("?");
    const head =
        queryAt === -1 ? beforeFragment : beforeFragment.slice(0, queryAt);
    const queryString = queryAt === -1 ? "" : beforeFragment.slice(queryAt + 1);

    const authorityEnd = head.indexOf("/", head.indexOf("://") + 3);
    const origin = authorityEnd === -1 ? head : head.slice(0, authorityEnd);
    const path = authorityEnd === -1 ? "/" : head.slice(authorityEnd);

    const query = queryString
        .split("&")
        .filter((segment) => segment !== "")
        .map((segment): [string, string] => {
            const eq = segment.indexOf("=");
            if (eq === -1) return [decodeComponent(segment), ""];
            return [
                decodeComponent(segment.slice(0, eq)),
                decodeComponent(segment.slice(eq + 1)),
            ];
        });

    return { base: `${origin.toLowerCase()}${path}`, query, fragment };
}

function build(
    name: string,
    description: string,
    input: Omit<BuildInput, "context">
): BuildFixture {
    const full: BuildInput = { context: CONTEXT, ...input };
    const link = FrakContextManager.update({
        url: full.baseUrl,
        context: full.context,
        attribution: mergeAttribution({
            perCall: full.perCall,
            defaults: full.defaults,
            productUtmContent: full.productUtmContent,
        }),
    });
    return {
        name,
        description,
        kind: "build",
        input: full,
        expected: link === null ? null : decodeLink(link),
    };
}

function parse(name: string, description: string, url: string): ParseFixture {
    return {
        name,
        description,
        kind: "parse",
        input: { url },
        expected: FrakContextManager.parse({ url }) ?? null,
    };
}

async function main() {
    if (FrakContextManager.compress(CONTEXT) !== TOKEN) {
        throw new Error("TOKEN no longer encodes CONTEXT: update it");
    }
    // The codec logs every undecodable value it rejects; the garbage-value case is meant to.
    console.error = () => {};
    const fixtures: (BuildFixture | ParseFixture)[] = [
        build("plain", "a plain https URL gains fCtx and utm_source=frak", {
            baseUrl: "https://shop.example/product",
        }),
        build("bare-origin", "an empty path becomes /", {
            baseUrl: "https://shop.example",
        }),
        build(
            "upper-host",
            "scheme and host are lowercased, the path keeps its case",
            {
                baseUrl: "HTTPS://Shop.Example/Path",
            }
        ),
        build("http-scheme", "plain http is accepted", {
            baseUrl: "http://shop.example/p",
        }),
        build("port-userinfo", "port and userinfo survive", {
            baseUrl: "https://user:pw@shop.example:8443/p",
        }),
        build("encoded-space", "%20 in a merchant value decodes to a space", {
            baseUrl: "https://shop.example/p?note=hello%20world",
        }),
        build("plus-space", "+ in a merchant value decodes to a space", {
            baseUrl: "https://shop.example/p?note=hello+world",
        }),
        build("encoded-plus", "%2B in a merchant value stays a literal plus", {
            baseUrl: "https://shop.example/p?q=a%2Bb",
        }),
        build(
            "raw-unicode",
            "a raw non-ASCII merchant value decodes to the same text",
            {
                baseUrl: "https://shop.example/p?name=café",
            }
        ),
        build(
            "unencoded-url-value",
            "an unencoded URL inside a merchant value splits on the first =",
            {
                baseUrl:
                    "https://shop.example/p?redirect=https://x.example/?a=1",
            }
        ),
        build("empty-value", "a key with an empty value is kept", {
            baseUrl: "https://shop.example/p?a=&b=1",
        }),
        build("key-no-value", "a key without = decodes to an empty value", {
            baseUrl: "https://shop.example/p?flag&x=1",
        }),
        build("trailing-question", "a lone ? contributes no query entries", {
            baseUrl: "https://shop.example/p?",
        }),
        build("fragment", "the fragment is kept after the query", {
            baseUrl: "https://shop.example/p?x=1#section",
        }),
        build(
            "fragment-no-query",
            "the query is inserted before the fragment",
            {
                baseUrl: "https://shop.example/p#top",
            }
        ),
        build("duplicate-keys", "duplicate merchant keys keep their order", {
            baseUrl: "https://shop.example/p?a=1&a=2",
        }),
        build("stale-fctx", "a stale fCtx is replaced", {
            baseUrl: "https://shop.example/p?fCtx=stale&x=1",
        }),
        build(
            "stale-fctx-lowercase",
            "a stale lowercase fctx is removed case-insensitively",
            {
                baseUrl: "https://shop.example/p?fctx=stale&x=1",
            }
        ),
        build(
            "stale-fctx-uppercase",
            "a stale uppercase FCTX is removed case-insensitively",
            {
                baseUrl: "https://shop.example/p?FCTX=stale&x=1",
            }
        ),
        build(
            "merchant-utm-source",
            "an existing utm_source is not overwritten",
            {
                baseUrl: "https://shop.example/p?utm_source=newsletter",
            }
        ),
        build(
            "merchant-utm-source-upper",
            "gap-fill is exact-case: UTM_SOURCE does not count as utm_source",
            {
                baseUrl: "https://shop.example/p?UTM_SOURCE=newsletter",
            }
        ),
        build(
            "merchant-empty-utm",
            "an existing empty utm_source still counts as present",
            {
                baseUrl: "https://shop.example/p?utm_source=",
            }
        ),
        build(
            "merchant-utm-no-value",
            "an existing utm_source without = still counts as present",
            {
                baseUrl: "https://shop.example/p?utm_source",
            }
        ),
        build(
            "merchant-utm-encoded-key",
            "keys match decoded: utm%5Fsource is utm_source",
            {
                baseUrl: "https://shop.example/p?utm%5Fsource=newsletter",
            }
        ),
        build(
            "stale-fctx-encoded-key",
            "a stale fCtx with a percent-encoded key is removed",
            {
                baseUrl: "https://shop.example/p?f%43tx=stale&x=1",
            }
        ),
        build("percall-all", "every per-call attribution field is written", {
            baseUrl: "https://shop.example/p",
            perCall: {
                utmSource: "s",
                utmMedium: "m",
                utmCampaign: "c",
                utmContent: "ct",
                utmTerm: "t",
                via: "v",
                ref: "r",
            },
        }),
        build(
            "defaults-only",
            "merchant defaults apply without a per-call override",
            {
                baseUrl: "https://shop.example/p",
                defaults: {
                    utmSource: "ds",
                    utmMedium: "dm",
                    utmCampaign: "dc",
                    utmTerm: "dt",
                    via: "dv",
                    ref: "dr",
                },
            }
        ),
        build(
            "percall-over-defaults",
            "per-call wins field by field over defaults",
            {
                baseUrl: "https://shop.example/p",
                perCall: { utmMedium: "m" },
                defaults: { utmMedium: "dm", utmCampaign: "dc" },
            }
        ),
        build(
            "percall-empty-string-over-default",
            "an empty per-call value overrides the default and is then omitted",
            {
                baseUrl: "https://shop.example/p",
                perCall: { utmMedium: "" },
                defaults: { utmMedium: "dm" },
            }
        ),
        build(
            "percall-empty-object",
            "an empty per-call object still lets defaults apply",
            {
                baseUrl: "https://shop.example/p",
                perCall: {},
                defaults: { utmCampaign: "dc" },
            }
        ),
        build(
            "product-utm-wins",
            "productUtmContent wins over perCall.utmContent",
            {
                baseUrl: "https://shop.example/p",
                perCall: { utmContent: "pc" },
                productUtmContent: "prod",
            }
        ),
        build(
            "product-utm-only",
            "productUtmContent alone produces utm_content",
            {
                baseUrl: "https://shop.example/p",
                productUtmContent: "prod",
            }
        ),
        build(
            "product-utm-empty",
            "an empty productUtmContent is absent, so perCall.utmContent applies",
            {
                baseUrl: "https://shop.example/p",
                perCall: { utmContent: "pc" },
                productUtmContent: "",
            }
        ),
        build(
            "values-need-encoding",
            "attribution values with reserved characters round-trip through decoding",
            {
                baseUrl: "https://shop.example/p",
                perCall: { utmCampaign: "black friday & co/€", via: "a=b?c#d" },
            }
        ),
        build("non-http-scheme", "a vendor scheme is refused", {
            baseUrl: "myapp://shop/p",
        }),
        build("ftp-scheme", "ftp is refused", {
            baseUrl: "ftp://shop.example/p",
        }),
        build("not-a-url", "a bare host without a scheme is refused", {
            baseUrl: "shop.example/p",
        }),

        parse(
            "exact",
            "fCtx in the query",
            `https://shop.example/p?fCtx=${TOKEN}`
        ),
        parse(
            "lowercase-key",
            "the key is matched case-insensitively: fctx",
            `https://shop.example/p?fctx=${TOKEN}`
        ),
        parse(
            "uppercase-key",
            "the key is matched case-insensitively: FCTX",
            `https://shop.example/p?FCTX=${TOKEN}`
        ),
        parse(
            "exact-wins-over-mangled",
            "an exact-case fCtx wins over a mangled duplicate",
            `https://shop.example/p?fctx=garbage&fCtx=${TOKEN}`
        ),
        parse(
            "percent-encoded-key",
            "the key is matched decoded: f%43tx is fCtx",
            `https://shop.example/p?f%43tx=${TOKEN}`
        ),
        parse(
            "percent-encoded-value",
            "a percent-encoded base64url character (%45 is E) decodes before the codec",
            `https://shop.example/p?fCtx=%45${TOKEN.slice(1)}`
        ),
        parse(
            "fragment-after",
            "a fragment after the query does not affect the value",
            `https://shop.example/p?fCtx=${TOKEN}#x`
        ),
        parse(
            "in-fragment-only",
            "fCtx inside the fragment is ignored",
            `https://shop.example/p#fCtx=${TOKEN}`
        ),
        parse("missing", "no fCtx is null", "https://shop.example/p?x=1"),
        parse(
            "garbage-value",
            "an undecodable value is null",
            "https://shop.example/p?fCtx=%%%"
        ),
        parse(
            "not-a-url",
            "a bare host without a scheme is null",
            `shop.example/p?fCtx=${TOKEN}`
        ),
    ];

    const names = fixtures.map((f) => `${f.kind}/${f.name}`);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
        throw new Error(`Duplicate fixture names: ${duplicates.join(", ")}`);
    }

    const outPath = new URL(
        "../src/context/fixtures/golden-sharing-links.json",
        import.meta.url
    );
    // Pure ASCII, like every corpus file: a raw `é` or `€` would hide a normalisation in a diff.
    const json = JSON.stringify(
        { formatVersion: 1, fixtures },
        null,
        4
    ).replace(
        /[\u0080-\uffff]/g,
        (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
    await Bun.write(outPath, `${json}\n`);
    console.log(`Wrote ${fixtures.length} fixtures to ${outPath.pathname}`);
}

main();

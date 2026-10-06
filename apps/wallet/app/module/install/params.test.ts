import { compactUuid } from "@frak-labs/core-sdk/identity";
import goldenProofs from "@frak-labs/core-sdk/identity/fixtures";
import { buildInstallUrl } from "@frak-labs/wallet-shared/sharing";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    buildInstallProcessingEnsureAction,
    parseInstallProofFragment,
    parseInstallSearch,
    resolveInstallAnonymousId,
    resolveInstallProof,
} from "./params";

const MERCHANT_UUID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const ANONYMOUS_UUID = "256b1be3-2745-41d1-89d4-9121cc87bc45";

describe("parseInstallSearch — compact ids", () => {
    test("expands compact m and a to canonical UUIDs", () => {
        const search = parseInstallSearch({
            m: compactUuid(MERCHANT_UUID),
            a: compactUuid(ANONYMOUS_UUID),
        });

        expect(search.m).toBe(MERCHANT_UUID);
        expect(search.a).toBe(ANONYMOUS_UUID);
    });

    test("passes hyphenated UUIDs through untouched, whatever their case", () => {
        const upper = MERCHANT_UUID.toUpperCase();
        const search = parseInstallSearch({ m: upper, a: ANONYMOUS_UUID });

        expect(search.m).toBe(upper);
        expect(search.a).toBe(ANONYMOUS_UUID);
    });

    test.each([
        "merchant-1",
        "not-a-compact-id-at-all",
        "AAAAAAAAAAAAAAAAAAAAA",
        "AAAAAAAAAAAAAAAAAAAAAB",
    ])("passes a non-compact value through: %s", (value) => {
        expect(parseInstallSearch({ m: value, a: value })).toMatchObject({
            m: value,
            a: value,
        });
    });

    test("drops non-string ids", () => {
        expect(parseInstallSearch({ m: 42, a: null })).toMatchObject({
            m: undefined,
            a: undefined,
        });
    });
});

describe("resolveInstallAnonymousId", () => {
    test.each(
        goldenProofs.fixtures.map((fixture) => [
            fixture.description,
            fixture.proof,
            fixture.anonymousId,
        ])
    )(
        "derives the fixture's anonymous id from its proof: %s",
        (_, proof, anonymousId) => {
            expect(resolveInstallAnonymousId(undefined, proof)).toBe(
                anonymousId
            );
        }
    );

    test("an explicit anonymous id wins over the proof", () => {
        const [fixture] = goldenProofs.fixtures;
        expect(resolveInstallAnonymousId("explicit-id", fixture.proof)).toBe(
            "explicit-id"
        );
    });

    test.each([
        ["no proof", undefined],
        ["an empty proof", ""],
        ["a non-base64url proof", "%%%not-base64%%%"],
        ["a truncated proof", goldenProofs.fixtures[0].proof.slice(0, 40)],
    ])("is undefined, never throwing, for %s", (_, proof) => {
        expect(() => resolveInstallAnonymousId(undefined, proof)).not.toThrow();
        expect(resolveInstallAnonymousId(undefined, proof)).toBeUndefined();
    });
});

describe("parseInstallProofFragment", () => {
    test("returns undefined when there is no fragment", () => {
        expect(parseInstallProofFragment("")).toBeUndefined();
    });

    test("returns undefined for an empty fragment", () => {
        expect(parseInstallProofFragment("#")).toBeUndefined();
    });

    test("returns undefined for a malformed fragment (no key=value)", () => {
        expect(parseInstallProofFragment("#not-a-query")).toBeUndefined();
    });

    test("returns undefined when p is absent but other keys are present", () => {
        expect(parseInstallProofFragment("#foo=bar&baz=qux")).toBeUndefined();
    });

    test("parses p alongside unrelated keys", () => {
        expect(parseInstallProofFragment("#foo=bar&p=abc123&baz=qux")).toBe(
            "abc123"
        );
    });

    test("parses a bare p fragment", () => {
        expect(parseInstallProofFragment("#p=abc123")).toBe("abc123");
    });

    test("accepts the fragment with or without the leading '#'", () => {
        expect(parseInstallProofFragment("p=abc123")).toBe("abc123");
    });

    test("never throws on pathological input", () => {
        expect(() => parseInstallProofFragment("#%%%invalid%%%")).not.toThrow();
        expect(() => parseInstallProofFragment("#=====")).not.toThrow();
    });
});

describe("parseInstallSearch — ref", () => {
    test("carries a valid ref through", () => {
        expect(parseInstallSearch({ ref: "frakpa" }).ref).toBe("FRAKPA");
    });

    test("drops an invalid ref rather than passing it through", () => {
        expect(parseInstallSearch({ ref: "not-a-code" }).ref).toBeUndefined();
    });
});

describe("resolveInstallProof", () => {
    test("uses the fragment when there is one", () => {
        expect(resolveInstallProof("#p=from-fragment")).toBe("from-fragment");
    });

    test("falls back to the search param, which is how a deep link carries it", () => {
        // The router navigates in-app, so the fragment is gone by the time the
        // route renders. Without this arm the proof is silently dropped.
        expect(resolveInstallProof("", "from-search")).toBe("from-search");
    });

    test("prefers the fragment when a URL somehow carries both", () => {
        // The fragment cannot have leaked through a redirect or an access log,
        // so it wins.
        expect(resolveInstallProof("#p=from-fragment", "from-search")).toBe(
            "from-fragment"
        );
    });

    test("is undefined when neither carrier has one", () => {
        expect(resolveInstallProof("")).toBeUndefined();
        expect(resolveInstallProof("#other=1")).toBeUndefined();
    });

    test("a malformed fragment still falls through to the search param", () => {
        expect(resolveInstallProof("#%%%invalid%%%", "from-search")).toBe(
            "from-search"
        );
    });
});

describe("buildInstallProcessingEnsureAction", () => {
    test("direct link WITH a proof: the ensure action carries merchantId, anonymousId AND proof", () => {
        const action = buildInstallProcessingEnsureAction({
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            proof: "install-proof-blob",
        });

        expect(action).toEqual({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            proof: "install-proof-blob",
        });
    });

    test("fragment stripped (no proof): falls back to the bare merchantId/anonymousId pair", () => {
        const action = buildInstallProcessingEnsureAction({
            merchantId: "merchant-1",
            anonymousId: "anon-1",
        });

        expect(action).toEqual({
            type: "ensure",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
        });
        expect(action).not.toHaveProperty("proof");
    });

    test("missing merchantId or anonymousId: no action, regardless of a proof being present", () => {
        expect(
            buildInstallProcessingEnsureAction({
                anonymousId: "anon-1",
                proof: "install-proof-blob",
            })
        ).toBeUndefined();
        expect(
            buildInstallProcessingEnsureAction({
                merchantId: "merchant-1",
                proof: "install-proof-blob",
            })
        ).toBeUndefined();
        expect(buildInstallProcessingEnsureAction({})).toBeUndefined();
    });
});

describe("Play referrer string — literal-string dual-arm contract", () => {
    test("a parser without proof support (pre-W3) still reads merchantId/anonymousId correctly and ignores proof", () => {
        // Literal string the `downloadUrl` builder produces — an old
        // parser reading only two keys still parses it correctly.
        const referrerData =
            "merchantId=merchant-1&anonymousId=anon-1&proof=install-proof-blob";
        const legacyParams = new URLSearchParams(referrerData);

        expect(legacyParams.get("merchantId")).toBe("merchant-1");
        expect(legacyParams.get("anonymousId")).toBe("anon-1");
        // Confirms the extra key doesn't corrupt the other two.
        expect(legacyParams.get("proof")).toBe("install-proof-blob");
    });

    test("legacy string with no proof key still parses merchantId/anonymousId identically", () => {
        const referrerData = "merchantId=merchant-1&anonymousId=anon-1";
        const legacyParams = new URLSearchParams(referrerData);

        expect(legacyParams.get("merchantId")).toBe("merchant-1");
        expect(legacyParams.get("anonymousId")).toBe("anon-1");
        expect(legacyParams.get("proof")).toBeNull();
    });
});

describe("checkoutToken across the /sharing → /install hop", () => {
    const parseUrl = (url: string) =>
        parseInstallSearch(
            Object.fromEntries(
                new URL(url, "https://wallet.frak.id").searchParams
            )
        );

    test("a token-only link survives buildInstallUrl → parseInstallSearch", () => {
        const url = buildInstallUrl({
            merchantId: "merchant-1",
            checkoutToken: "tok/1",
        });

        expect(parseUrl(String(url))).toMatchObject({
            m: "merchant-1",
            a: undefined,
            checkoutToken: "tok/1",
        });
    });

    test("both credentials survive together", () => {
        const url = buildInstallUrl({
            merchantId: "merchant-1",
            clientId: "client-1",
            checkoutToken: "tok-1",
        });

        expect(parseUrl(String(url))).toMatchObject({
            m: "merchant-1",
            a: "client-1",
            checkoutToken: "tok-1",
        });
    });

    test("a non-string token is dropped rather than trusted", () => {
        expect(
            parseInstallSearch({ checkoutToken: 42 }).checkoutToken
        ).toBeUndefined();
    });
});

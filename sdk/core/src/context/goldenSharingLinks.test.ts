import { describe, expect, it } from "../../tests/vitest-fixtures";
import type {
    AttributionDefaults,
    AttributionParams,
    FrakContext,
    FrakContextV2,
} from "../types";
import goldenSharingLinks from "./fixtures/golden-sharing-links.json";
import { FrakContextManager } from "./frakContext";
import { mergeAttribution } from "./mergeAttribution";

type DecodedLink = {
    base: string;
    query: [string, string][];
    fragment: string;
};

type BuildFixture = {
    name: string;
    kind: "build";
    input: {
        context: FrakContextV2;
        baseUrl: string;
        perCall?: AttributionParams;
        defaults?: AttributionDefaults;
        productUtmContent?: string;
    };
    expected: DecodedLink | null;
};

type ParseFixture = {
    name: string;
    kind: "parse";
    input: { url: string };
    expected: FrakContext | null;
};

const fixtures = goldenSharingLinks.fixtures as unknown as (
    | BuildFixture
    | ParseFixture
)[];
const buildFixtures = fixtures.filter(
    (f): f is BuildFixture => f.kind === "build"
);
const parseFixtures = fixtures.filter(
    (f): f is ParseFixture => f.kind === "parse"
);

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

describe("golden sharing-links fixtures", () => {
    it("declares format version 1", () => {
        expect(goldenSharingLinks.formatVersion).toBe(1);
    });

    it("has unique names within each kind", () => {
        for (const group of [buildFixtures, parseFixtures]) {
            const names = group.map((f) => f.name);
            expect(new Set(names).size).toBe(names.length);
        }
        expect(buildFixtures.length + parseFixtures.length).toBe(
            fixtures.length
        );
    });

    describe("build", () => {
        it.each(buildFixtures.map((f) => [f.name, f] as const))(
            "%s",
            (_name, fixture) => {
                const {
                    context,
                    baseUrl,
                    perCall,
                    defaults,
                    productUtmContent,
                } = fixture.input;

                const link = FrakContextManager.update({
                    url: baseUrl,
                    context,
                    attribution: mergeAttribution({
                        perCall,
                        defaults,
                        productUtmContent,
                    }),
                });

                expect(link === null ? null : decodeLink(link)).toEqual(
                    fixture.expected
                );
            }
        );
    });

    describe("parse", () => {
        it.each(parseFixtures.map((f) => [f.name, f] as const))(
            "%s",
            (_name, fixture) => {
                expect(
                    FrakContextManager.parse({ url: fixture.input.url }) ?? null
                ).toEqual(fixture.expected);
            }
        );
    });
});

describe("decodeLink", () => {
    it("lowercases scheme and authority and appends / to an empty path", () => {
        expect(decodeLink("HTTPS://Shop.Example?a=1")).toEqual({
            base: "https://shop.example/",
            query: [["a", "1"]],
            fragment: "",
        });
    });

    it("splits on the first = and decodes + and %XX", () => {
        expect(
            decodeLink("https://s.example/p?k=a=b&n=x+y%2Bz&flag&&")
        ).toEqual({
            base: "https://s.example/p",
            query: [
                ["k", "a=b"],
                ["n", "x y+z"],
                ["flag", ""],
            ],
            fragment: "",
        });
    });

    it("keeps the fragment from # inclusive", () => {
        expect(decodeLink("https://s.example/p?#top").fragment).toBe("#top");
    });
});

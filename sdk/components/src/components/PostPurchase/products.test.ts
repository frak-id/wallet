import { describe, expect, it } from "vitest";
import {
    coerceProductCandidates,
    normalizeProductCandidate,
} from "./products";

describe("coerceProductCandidates", () => {
    describe("falsy / unsupported inputs", () => {
        it("returns null for undefined", () => {
            expect(coerceProductCandidates(undefined)).toBeNull();
        });

        it("returns null for the empty string", () => {
            expect(coerceProductCandidates("")).toBeNull();
        });

        // Defence-in-depth: although the type says `string | array | undefined`,
        // surfaces that bypass the type system (raw HTML attribute setters,
        // misuse from JS) might pass numbers / objects / null. We don't want
        // those to crash downstream.
        it("returns null for non-string non-array values (number)", () => {
            expect(
                coerceProductCandidates(42 as unknown as undefined)
            ).toBeNull();
        });

        it("returns null for non-string non-array values (plain object)", () => {
            expect(
                coerceProductCandidates(
                    { title: "x" } as unknown as undefined
                )
            ).toBeNull();
        });

        it("returns null for null", () => {
            expect(
                coerceProductCandidates(null as unknown as undefined)
            ).toBeNull();
        });
    });

    describe("array inputs (JS-property surface)", () => {
        it("passes through a non-empty real array unchanged", () => {
            const input = [{ title: "x" }, { title: "y" }];
            expect(coerceProductCandidates(input)).toBe(input);
        });

        it("passes through an empty array (caller decides downstream)", () => {
            const input: never[] = [];
            const result = coerceProductCandidates(input);
            expect(result).toBe(input);
            expect(result).toEqual([]);
        });
    });

    describe("string inputs (HTML-attribute surface)", () => {
        it("parses a JSON-encoded array of products", () => {
            const json = JSON.stringify([{ title: "x" }, { title: "y" }]);
            expect(coerceProductCandidates(json)).toEqual([
                { title: "x" },
                { title: "y" },
            ]);
        });

        it("parses a JSON-encoded empty array", () => {
            expect(coerceProductCandidates("[]")).toEqual([]);
        });

        it("returns null when JSON decodes to a plain object", () => {
            expect(coerceProductCandidates('{"title":"x"}')).toBeNull();
        });

        it("returns null when JSON decodes to a primitive (string)", () => {
            expect(coerceProductCandidates('"foo"')).toBeNull();
        });

        it("returns null when JSON decodes to a primitive (number)", () => {
            expect(coerceProductCandidates("42")).toBeNull();
        });

        it("returns null when JSON decodes to null", () => {
            expect(coerceProductCandidates("null")).toBeNull();
        });

        it("returns null when the string is not valid JSON", () => {
            expect(coerceProductCandidates("not json")).toBeNull();
            expect(coerceProductCandidates("[broken")).toBeNull();
        });
    });
});

describe("normalizeProductCandidate", () => {
    describe("rejects non-object / title-less candidates", () => {
        it.each([
            ["null", null],
            ["undefined", undefined],
            ["string", "foo"],
            ["number", 42],
            ["boolean", true],
            ["array", []],
        ] as const)("returns null for %s", (_label, value) => {
            expect(normalizeProductCandidate(value)).toBeNull();
        });

        it("returns null for an empty object", () => {
            expect(normalizeProductCandidate({})).toBeNull();
        });

        it("returns null when title is missing", () => {
            expect(
                normalizeProductCandidate({ imageUrl: "https://x.test" })
            ).toBeNull();
        });

        it("returns null when title is the empty string", () => {
            expect(normalizeProductCandidate({ title: "" })).toBeNull();
        });

        it("returns null when title is whitespace only", () => {
            expect(normalizeProductCandidate({ title: "   " })).toBeNull();
            expect(normalizeProductCandidate({ title: "\t\n" })).toBeNull();
        });

        it("returns null when title is a non-string value", () => {
            expect(normalizeProductCandidate({ title: 42 })).toBeNull();
            expect(normalizeProductCandidate({ title: true })).toBeNull();
            expect(normalizeProductCandidate({ title: null })).toBeNull();
            expect(normalizeProductCandidate({ title: {} })).toBeNull();
        });
    });

    describe("title handling", () => {
        it("keeps a plain string title verbatim", () => {
            expect(normalizeProductCandidate({ title: "Hello" })).toEqual({
                title: "Hello",
            });
        });

        it("trims surrounding whitespace from the title", () => {
            expect(
                normalizeProductCandidate({ title: "  Hello  " })
            ).toEqual({ title: "Hello" });
        });

        it("preserves internal whitespace and unicode", () => {
            expect(
                normalizeProductCandidate({
                    title: "Babies camel cuir velours bout carré",
                })
            ).toEqual({ title: "Babies camel cuir velours bout carré" });
        });
    });

    describe("imageUrl gating", () => {
        it.each(["https://example.com/img.jpg", "http://example.com/img.jpg"])(
            "keeps an http(s) URL: %s",
            (url) => {
                expect(
                    normalizeProductCandidate({ title: "x", imageUrl: url })
                ).toEqual({ title: "x", imageUrl: url });
            }
        );

        it.each([
            ["javascript: scheme", "javascript:alert(1)"],
            ["data: scheme", "data:image/png;base64,abc"],
            ["ftp: scheme", "ftp://example.com/img.jpg"],
            ["file: scheme", "file:///etc/passwd"],
            ["protocol-relative URL", "//example.com/img.jpg"],
            ["relative path", "/relative/path.jpg"],
            ["bare hostname", "example.com/img.jpg"],
            ["empty string", ""],
            ["garbage", "not a url"],
        ])("drops imageUrl with %s", (_label, url) => {
            const result = normalizeProductCandidate({
                title: "x",
                imageUrl: url,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("imageUrl");
        });

        it.each([
            ["number", 42],
            ["null", null],
            ["array", ["https://example.com/img.jpg"]],
            ["object", { url: "https://example.com/img.jpg" }],
        ])("drops non-string imageUrl (%s)", (_label, value) => {
            const result = normalizeProductCandidate({
                title: "x",
                imageUrl: value,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("imageUrl");
        });
    });

    describe("link gating", () => {
        it("keeps an https link", () => {
            expect(
                normalizeProductCandidate({
                    title: "x",
                    link: "https://example.com/product/123",
                })
            ).toEqual({
                title: "x",
                link: "https://example.com/product/123",
            });
        });

        it.each([
            ["javascript: scheme", "javascript:alert(1)"],
            ["data: scheme", "data:text/html,<script>alert(1)</script>"],
            ["mailto: scheme", "mailto:foo@example.com"],
            ["empty string", ""],
            ["garbage", "<a href"],
        ])("drops link with %s", (_label, value) => {
            const result = normalizeProductCandidate({
                title: "x",
                link: value,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("link");
        });

        it("drops non-string link", () => {
            const result = normalizeProductCandidate({
                title: "x",
                link: 42,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("link");
        });
    });

    describe("utmContent handling", () => {
        it("keeps a non-empty string utmContent verbatim", () => {
            expect(
                normalizeProductCandidate({
                    title: "x",
                    utmContent: "summer-2024",
                })
            ).toEqual({ title: "x", utmContent: "summer-2024" });
        });

        it("drops an empty utmContent", () => {
            const result = normalizeProductCandidate({
                title: "x",
                utmContent: "",
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("utmContent");
        });

        it("drops a non-string utmContent", () => {
            const result = normalizeProductCandidate({
                title: "x",
                utmContent: 42,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("utmContent");
        });
    });

    describe("integration", () => {
        it("keeps every valid optional field together", () => {
            const result = normalizeProductCandidate({
                title: "Boots en cuir noir",
                imageUrl: "https://cdn.example.com/boots.jpg",
                link: "https://shop.example.com/boots",
                utmContent: "boots-sku-42",
            });
            expect(result).toEqual({
                title: "Boots en cuir noir",
                imageUrl: "https://cdn.example.com/boots.jpg",
                link: "https://shop.example.com/boots",
                utmContent: "boots-sku-42",
            });
        });

        it("ignores unknown extra fields without crashing", () => {
            const result = normalizeProductCandidate({
                title: "x",
                foo: "bar",
                price: 42,
                nested: { a: 1 },
            });
            expect(result).toEqual({ title: "x" });
        });

        it("partial validity: keeps title + valid link, drops bad imageUrl", () => {
            expect(
                normalizeProductCandidate({
                    title: "x",
                    imageUrl: "javascript:evil()",
                    link: "https://shop.example.com/x",
                })
            ).toEqual({
                title: "x",
                link: "https://shop.example.com/x",
            });
        });
    });
});

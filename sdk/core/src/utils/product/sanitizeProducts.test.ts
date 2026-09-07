import { describe, expect, it } from "vitest";
import { compressJsonToB64 } from "../compression/compress";
import {
    coerceProductCandidates,
    decodeProductsParam,
    normalizeProductDetails,
    normalizeSharingProduct,
    sanitizeProductDetailsList,
    sanitizeSharingProducts,
} from "./sanitizeProducts";

describe("coerceProductCandidates", () => {
    describe("falsy / unsupported inputs", () => {
        it("returns null for undefined", () => {
            expect(coerceProductCandidates(undefined)).toBeNull();
        });

        it("returns null for the empty string", () => {
            expect(coerceProductCandidates("")).toBeNull();
        });

        // Defence-in-depth: although the type says `unknown`, we still want
        // bad inputs (numbers / objects / null) to bail out cleanly so we
        // don't crash downstream.
        it("returns null for non-string non-array values (number)", () => {
            expect(coerceProductCandidates(42)).toBeNull();
        });

        it("returns null for non-string non-array values (plain object)", () => {
            expect(coerceProductCandidates({ title: "x" })).toBeNull();
        });

        it("returns null for null", () => {
            expect(coerceProductCandidates(null)).toBeNull();
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

describe("normalizeProductDetails", () => {
    it("returns undefined for non-object candidates", () => {
        expect(normalizeProductDetails(null)).toBeUndefined();
        expect(normalizeProductDetails(undefined)).toBeUndefined();
        expect(normalizeProductDetails("foo")).toBeUndefined();
        expect(normalizeProductDetails(42)).toBeUndefined();
        expect(normalizeProductDetails(true)).toBeUndefined();
        expect(normalizeProductDetails([])).toBeUndefined();
    });

    it("returns undefined for an empty object", () => {
        expect(normalizeProductDetails({})).toBeUndefined();
    });

    it("returns undefined when every field is junk (all-junk entry dropped)", () => {
        expect(
            normalizeProductDetails({
                productId: "",
                sku: "   ",
                name: 42,
                quantity: "not-a-number",
                unitPrice: null,
                totalPrice: {},
            })
        ).toBeUndefined();
    });

    describe("string fields (productId / sku / name)", () => {
        it("keeps non-empty trimmed strings", () => {
            expect(
                normalizeProductDetails({
                    productId: "  prod_123  ",
                    sku: "SHOE-42",
                    name: " Running Shoe ",
                })
            ).toEqual({
                productId: "prod_123",
                sku: "SHOE-42",
                name: "Running Shoe",
            });
        });

        it("drops empty / whitespace-only strings", () => {
            expect(
                normalizeProductDetails({ productId: "", sku: "   " })
            ).toBeUndefined();
        });

        it("drops non-string values", () => {
            expect(
                normalizeProductDetails({ productId: 42, sku: null })
            ).toBeUndefined();
        });
    });

    describe("numeric fields (quantity / unitPrice / totalPrice)", () => {
        it("accepts real numbers", () => {
            expect(
                normalizeProductDetails({
                    quantity: 2,
                    unitPrice: 79.9,
                    totalPrice: 159.8,
                })
            ).toEqual({ quantity: 2, unitPrice: 79.9, totalPrice: 159.8 });
        });

        it("accepts numeric strings (HTML attribute / URL param surface)", () => {
            expect(
                normalizeProductDetails({
                    quantity: "2",
                    unitPrice: "79.90",
                    totalPrice: "159.80",
                })
            ).toEqual({ quantity: 2, unitPrice: 79.9, totalPrice: 159.8 });
        });

        it("drops NaN / unparseable numeric strings", () => {
            const result = normalizeProductDetails({
                unitPrice: "not-a-price",
                sku: "SHOE-42",
            });
            expect(result).toEqual({ sku: "SHOE-42" });
            expect(result).not.toHaveProperty("unitPrice");
        });

        it("drops non-finite numbers", () => {
            const result = normalizeProductDetails({
                unitPrice: Number.NaN,
                totalPrice: Number.POSITIVE_INFINITY,
                sku: "SHOE-42",
            });
            expect(result).toEqual({ sku: "SHOE-42" });
            expect(result).not.toHaveProperty("unitPrice");
            expect(result).not.toHaveProperty("totalPrice");
        });

        it("drops empty numeric strings", () => {
            const result = normalizeProductDetails({
                quantity: "",
                sku: "SHOE-42",
            });
            expect(result).toEqual({ sku: "SHOE-42" });
            expect(result).not.toHaveProperty("quantity");
        });
    });

    it("ignores unknown extra fields without crashing", () => {
        expect(
            normalizeProductDetails({
                sku: "SHOE-42",
                title: "irrelevant here",
                foo: "bar",
            })
        ).toEqual({ sku: "SHOE-42" });
    });
});

describe("sanitizeProductDetailsList", () => {
    it("returns undefined for falsy / unsupported inputs", () => {
        expect(sanitizeProductDetailsList(undefined)).toBeUndefined();
        expect(sanitizeProductDetailsList(null)).toBeUndefined();
        expect(sanitizeProductDetailsList("")).toBeUndefined();
        expect(sanitizeProductDetailsList(42)).toBeUndefined();
    });

    it("returns undefined for an empty array", () => {
        expect(sanitizeProductDetailsList([])).toBeUndefined();
    });

    it("returns undefined when every candidate is all-junk", () => {
        expect(
            sanitizeProductDetailsList([{}, { productId: "" }])
        ).toBeUndefined();
    });

    it("does not require a title", () => {
        expect(sanitizeProductDetailsList([{ sku: "SHOE-42" }])).toEqual([
            { sku: "SHOE-42" },
        ]);
    });

    it("accepts a JSON-stringified payload (HTML-attribute surface)", () => {
        expect(
            sanitizeProductDetailsList(
                JSON.stringify([{ sku: "SHOE-42", unitPrice: "79.90" }])
            )
        ).toEqual([{ sku: "SHOE-42", unitPrice: 79.9 }]);
    });

    it("drops junk entries while keeping valid ones", () => {
        expect(
            sanitizeProductDetailsList([
                { sku: "SHOE-42" },
                {},
                { productId: "prod_9" },
            ])
        ).toEqual([{ sku: "SHOE-42" }, { productId: "prod_9" }]);
    });
});

describe("normalizeSharingProduct", () => {
    describe("rejects candidates with nothing usable", () => {
        it.each([
            ["null", null],
            ["undefined", undefined],
            ["string", "foo"],
            ["number", 42],
            ["boolean", true],
            ["array", []],
        ] as const)("returns null for %s", (_label, value) => {
            expect(normalizeSharingProduct(value)).toBeNull();
        });

        it("returns null for an empty object", () => {
            expect(normalizeSharingProduct({})).toBeNull();
        });

        it("returns null when neither a title nor a scope field survives", () => {
            expect(
                normalizeSharingProduct({ imageUrl: "https://x.test" })
            ).toBeNull();
        });

        it("returns null when title is the empty string and there is no scope field", () => {
            expect(normalizeSharingProduct({ title: "" })).toBeNull();
        });

        it("returns null when title is whitespace only and there is no scope field", () => {
            expect(normalizeSharingProduct({ title: "   " })).toBeNull();
            expect(normalizeSharingProduct({ title: "\t\n" })).toBeNull();
        });

        it("returns null when title is a non-string value and there is no scope field", () => {
            expect(normalizeSharingProduct({ title: 42 })).toBeNull();
            expect(normalizeSharingProduct({ title: true })).toBeNull();
            expect(normalizeSharingProduct({ title: null })).toBeNull();
            expect(normalizeSharingProduct({ title: {} })).toBeNull();
        });
    });

    describe("title-less entries keep their scope fields (PSC-27)", () => {
        it("keeps a sku-only entry and emits no title key", () => {
            const result = normalizeSharingProduct({ sku: "SHOE-42" });

            expect(result).toEqual({ sku: "SHOE-42" });
            expect(result).not.toHaveProperty("title");
        });

        it("keeps scope fields when the title is present but empty", () => {
            expect(
                normalizeSharingProduct({ title: "  ", sku: "SHOE-42" })
            ).toEqual({ sku: "SHOE-42" });
        });

        it("keeps a title-less entry's other scope fields and link", () => {
            expect(
                normalizeSharingProduct({
                    productId: "prod_9",
                    unitPrice: "79.90",
                    link: "https://shop.example.com/shoes",
                })
            ).toEqual({
                productId: "prod_9",
                unitPrice: 79.9,
                link: "https://shop.example.com/shoes",
            });
        });
    });

    describe("title handling", () => {
        it("keeps a plain string title verbatim", () => {
            expect(normalizeSharingProduct({ title: "Hello" })).toEqual({
                title: "Hello",
            });
        });

        it("trims surrounding whitespace from the title", () => {
            expect(normalizeSharingProduct({ title: "  Hello  " })).toEqual({
                title: "Hello",
            });
        });

        it("preserves internal whitespace and unicode", () => {
            expect(
                normalizeSharingProduct({
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
                    normalizeSharingProduct({ title: "x", imageUrl: url })
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
            const result = normalizeSharingProduct({
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
            const result = normalizeSharingProduct({
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
                normalizeSharingProduct({
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
            const result = normalizeSharingProduct({
                title: "x",
                link: value,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("link");
        });

        it("drops non-string link", () => {
            const result = normalizeSharingProduct({
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
                normalizeSharingProduct({
                    title: "x",
                    utmContent: "summer-2024",
                })
            ).toEqual({ title: "x", utmContent: "summer-2024" });
        });

        it("drops an empty utmContent", () => {
            const result = normalizeSharingProduct({
                title: "x",
                utmContent: "",
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("utmContent");
        });

        it("drops a non-string utmContent", () => {
            const result = normalizeSharingProduct({
                title: "x",
                utmContent: 42,
            });
            expect(result).toEqual({ title: "x" });
            expect(result).not.toHaveProperty("utmContent");
        });
    });

    describe("ProductDetails scope fields", () => {
        it("carries scope fields through alongside the display fields", () => {
            expect(
                normalizeSharingProduct({
                    title: "Running Shoe",
                    sku: "SHOE-42",
                    productId: "prod_123",
                    unitPrice: "79.90",
                    quantity: 2,
                })
            ).toEqual({
                title: "Running Shoe",
                sku: "SHOE-42",
                productId: "prod_123",
                unitPrice: 79.9,
                quantity: 2,
            });
        });

        it("omits scope fields entirely when none are present (no empty keys)", () => {
            const result = normalizeSharingProduct({ title: "x" });
            expect(result).toEqual({ title: "x" });
            expect(Object.keys(result ?? {})).toEqual(["title"]);
        });

        it("drops an unparseable unitPrice while keeping the title and other fields", () => {
            const result = normalizeSharingProduct({
                title: "x",
                sku: "SHOE-42",
                unitPrice: "garbage",
            });
            expect(result).toEqual({ title: "x", sku: "SHOE-42" });
            expect(result).not.toHaveProperty("unitPrice");
        });
    });

    describe("integration", () => {
        it("keeps every valid optional field together", () => {
            const result = normalizeSharingProduct({
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
            const result = normalizeSharingProduct({
                title: "x",
                foo: "bar",
                nested: { a: 1 },
            });
            expect(result).toEqual({ title: "x" });
        });

        it("partial validity: keeps title + valid link, drops bad imageUrl", () => {
            expect(
                normalizeSharingProduct({
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

describe("sanitizeSharingProducts", () => {
    it("returns undefined for falsy / unsupported inputs", () => {
        expect(sanitizeSharingProducts(undefined)).toBeUndefined();
        expect(sanitizeSharingProducts(null)).toBeUndefined();
        expect(sanitizeSharingProducts("")).toBeUndefined();
        expect(sanitizeSharingProducts(42)).toBeUndefined();
        expect(sanitizeSharingProducts({ title: "x" })).toBeUndefined();
    });

    it("returns undefined for an empty array", () => {
        // Caller intent: no products to display.
        expect(sanitizeSharingProducts([])).toBeUndefined();
    });

    it("returns undefined when every candidate is malformed", () => {
        expect(
            sanitizeSharingProducts([
                { imageUrl: "https://x.test" },
                { title: "" },
            ])
        ).toBeUndefined();
    });

    it("keeps a title-less entry that carries a sku (PSC-27)", () => {
        expect(sanitizeSharingProducts([{ sku: "SHOE-42" }])).toEqual([
            { sku: "SHOE-42" },
        ]);
    });

    it("keeps title-less and titled entries side by side, in order", () => {
        expect(
            sanitizeSharingProducts([
                { sku: "SHOE-42" },
                { title: "Socks", sku: "SOCK-9" },
            ])
        ).toEqual([{ sku: "SHOE-42" }, { title: "Socks", sku: "SOCK-9" }]);
    });

    it("returns the sanitised entries when at least one is valid", () => {
        expect(
            sanitizeSharingProducts([
                { title: "Boots", link: "javascript:evil()" },
                { title: "" },
                { title: "Shoes", link: "https://shop.example.com/shoes" },
            ])
        ).toEqual([
            { title: "Boots" },
            { title: "Shoes", link: "https://shop.example.com/shoes" },
        ]);
    });

    it("accepts a JSON-stringified payload (HTML-attribute surface)", () => {
        expect(
            sanitizeSharingProducts(
                JSON.stringify([
                    { title: "x", imageUrl: "https://cdn.example.com/x.jpg" },
                ])
            )
        ).toEqual([{ title: "x", imageUrl: "https://cdn.example.com/x.jpg" }]);
    });

    it("carries scope fields through for every entry", () => {
        expect(
            sanitizeSharingProducts([
                { title: "Shoe", sku: "SHOE-42", unitPrice: "79.90" },
            ])
        ).toEqual([{ title: "Shoe", sku: "SHOE-42", unitPrice: 79.9 }]);
    });
});

describe("decodeProductsParam", () => {
    it("returns undefined for empty / null / undefined input", () => {
        expect(decodeProductsParam(undefined)).toBeUndefined();
        expect(decodeProductsParam(null)).toBeUndefined();
        expect(decodeProductsParam("")).toBeUndefined();
    });

    it("decodes a compressed array and sanitises every entry", () => {
        const encoded = compressJsonToB64([
            {
                title: "Boots",
                imageUrl: "https://cdn.example.com/boots.jpg",
                link: "https://shop.example.com/boots",
            },
            {
                title: "Bad",
                imageUrl: "javascript:alert(1)",
                link: "https://shop.example.com/bad",
            },
        ]);
        expect(decodeProductsParam(encoded)).toEqual([
            {
                title: "Boots",
                imageUrl: "https://cdn.example.com/boots.jpg",
                link: "https://shop.example.com/boots",
            },
            {
                title: "Bad",
                link: "https://shop.example.com/bad",
            },
        ]);
    });

    it("returns undefined when the decoded payload is not an array", () => {
        const encoded = compressJsonToB64({ title: "x" });
        expect(decodeProductsParam(encoded)).toBeUndefined();
    });

    it("returns undefined when the decoded array has no usable entries", () => {
        const encoded = compressJsonToB64([{ title: "" }, { foo: "bar" }]);
        expect(decodeProductsParam(encoded)).toBeUndefined();
    });

    it("returns undefined for a malformed / non-base64 input", () => {
        expect(decodeProductsParam("$$$ not-base64 $$$")).toBeUndefined();
    });

    it("decodes scope fields alongside display fields", () => {
        const encoded = compressJsonToB64([
            { title: "Shoe", sku: "SHOE-42", unitPrice: 79.9, quantity: 2 },
        ]);
        expect(decodeProductsParam(encoded)).toEqual([
            { title: "Shoe", sku: "SHOE-42", unitPrice: 79.9, quantity: 2 },
        ]);
    });
});

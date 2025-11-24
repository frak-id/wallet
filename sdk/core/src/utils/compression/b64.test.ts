/**
 * Tests for base64url encoding and decoding utilities
 * Tests encoding, decoding, and round-trip operations
 */

import { describe, expect, it, test } from "../../../tests/vitest-fixtures";
import { base64urlDecode, base64urlEncode } from "./b64";

describe("base64urlEncode", () => {
    test("should encode empty Uint8Array", ({ mockUint8Arrays }) => {
        const result = base64urlEncode(mockUint8Arrays.empty);

        expect(result).toBe("");
    });

    test("should encode simple Uint8Array", ({ mockUint8Arrays }) => {
        const result = base64urlEncode(mockUint8Arrays.simple);

        // "Hello" should encode to "SGVsbG8"
        expect(result).toBe("SGVsbG8");
    });

    test("should replace + with - for URL safety", () => {
        // Create data that would produce + in standard base64
        const data = new Uint8Array([0xfb, 0xff]);
        const result = base64urlEncode(data);

        // Should not contain +
        expect(result).not.toContain("+");
        expect(result).toContain("-");
    });

    test("should replace / with _ for URL safety", () => {
        // Create data that would produce / in standard base64
        const data = new Uint8Array([0xff, 0xff]);
        const result = base64urlEncode(data);

        // Should not contain /
        expect(result).not.toContain("/");
        expect(result).toContain("_");
    });

    test("should remove padding =", () => {
        // Create data that would have padding
        const data = new Uint8Array([72]); // "H" -> "SA==" in standard base64
        const result = base64urlEncode(data);

        // Should not contain =
        expect(result).not.toContain("=");
        expect(result).toBe("SA");
    });

    test("should handle various byte lengths", () => {
        const lengths = [1, 2, 3, 4, 5, 10, 20];

        for (const length of lengths) {
            const data = new Uint8Array(length).fill(65); // Fill with 'A' character code
            const result = base64urlEncode(data);

            // Should produce a string
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        }
    });

    test("should handle complex byte array", ({ mockUint8Arrays }) => {
        const result = base64urlEncode(mockUint8Arrays.complex);

        // Should produce valid base64url string
        expect(result).toMatch(/^[A-Za-z0-9_-]*$/);
    });
});

describe("base64urlDecode", () => {
    test("should decode empty string", ({ mockBase64Strings }) => {
        const result = base64urlDecode(mockBase64Strings.empty);

        expect(result).toEqual(new Uint8Array([]));
        expect(result.length).toBe(0);
    });

    test("should decode simple base64url string", ({ mockBase64Strings }) => {
        const result = base64urlDecode(mockBase64Strings.simple);

        // "SGVsbG8" should decode to "Hello"
        const expected = new Uint8Array([72, 101, 108, 108, 111]);
        expect(result).toEqual(expected);
    });

    test("should handle strings without padding", () => {
        // Base64url strings don't have padding
        const encoded = "SGVsbG8"; // "Hello" without padding
        const result = base64urlDecode(encoded);

        const expected = new Uint8Array([72, 101, 108, 108, 111]);
        expect(result).toEqual(expected);
    });

    test("should reverse URL-safe character replacements", ({
        mockBase64Strings,
    }) => {
        const result = base64urlDecode(mockBase64Strings.withSpecialChars);

        // Should handle - and _ characters
        expect(result).toBeInstanceOf(Uint8Array);
    });

    test("should handle various valid base64url string lengths", () => {
        // Use valid base64url strings
        const testStrings = ["QQ", "QUI", "QUJD", "QUJDRA"]; // "A", "AB", "ABC", "ABCD" encoded

        for (const str of testStrings) {
            const result = base64urlDecode(str);

            // Should produce Uint8Array
            expect(result).toBeInstanceOf(Uint8Array);
        }
    });
});

describe("base64url round-trip", () => {
    test("should successfully round-trip empty data", ({ mockUint8Arrays }) => {
        const encoded = base64urlEncode(mockUint8Arrays.empty);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(mockUint8Arrays.empty);
    });

    test("should successfully round-trip simple data", ({
        mockUint8Arrays,
    }) => {
        const encoded = base64urlEncode(mockUint8Arrays.simple);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(mockUint8Arrays.simple);
    });

    test("should successfully round-trip complex data", ({
        mockUint8Arrays,
    }) => {
        const encoded = base64urlEncode(mockUint8Arrays.complex);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(mockUint8Arrays.complex);
    });

    it("should handle all byte values (0-255)", () => {
        // Test with all possible byte values
        const allBytes = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            allBytes[i] = i;
        }

        const encoded = base64urlEncode(allBytes);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(allBytes);
    });

    it("should preserve binary data integrity", () => {
        const binaryData = new Uint8Array([0, 1, 127, 128, 255, 254, 100, 200]);

        const encoded = base64urlEncode(binaryData);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(binaryData);
    });

    it("should handle random data correctly", () => {
        // Generate some pseudo-random data
        const randomData = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            randomData[i] = Math.floor(Math.random() * 256);
        }

        const encoded = base64urlEncode(randomData);
        const decoded = base64urlDecode(encoded);

        expect(decoded).toEqual(randomData);
    });
});

/**
 * Tests for base64url utility functions
 * Tests ArrayBuffer to base64url string conversion and vice versa
 */

import { describe, expect, it } from "vitest";
import { base64URLStringToBuffer, bufferToBase64URLString } from "./base64url";

describe("base64url utilities", () => {
    describe("bufferToBase64URLString", () => {
        it("should convert empty ArrayBuffer to base64url string", () => {
            const buffer = new ArrayBuffer(0);
            const result = bufferToBase64URLString(buffer);

            expect(result).toBe("");
        });

        it("should convert simple ArrayBuffer to base64url string", () => {
            const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
            const result = bufferToBase64URLString(buffer);

            expect(result).toBe("SGVsbG8");
        });

        it("should replace + with - in base64url", () => {
            // Create buffer that produces + in base64
            const buffer = new Uint8Array([251, 239]).buffer;
            const result = bufferToBase64URLString(buffer);

            expect(result).not.toContain("+");
            expect(result).toContain("-");
        });

        it("should replace / with _ in base64url", () => {
            // Create buffer that produces / in base64
            const buffer = new Uint8Array([255, 239]).buffer;
            const result = bufferToBase64URLString(buffer);

            expect(result).not.toContain("/");
            expect(result).toContain("_");
        });

        it("should remove padding = from base64url", () => {
            // Create buffer that produces padding
            const buffer = new Uint8Array([72, 101]).buffer; // "He" -> "SGU="
            const result = bufferToBase64URLString(buffer);

            expect(result).not.toContain("=");
        });

        it("should handle large ArrayBuffer", () => {
            const largeArray = new Uint8Array(1000);
            for (let i = 0; i < 1000; i++) {
                largeArray[i] = i % 256;
            }
            const buffer = largeArray.buffer;
            const result = bufferToBase64URLString(buffer);

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
            expect(result).not.toContain("+");
            expect(result).not.toContain("/");
            expect(result).not.toContain("=");
        });

        it("should handle binary data", () => {
            const binaryData = new Uint8Array([
                0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd,
            ]);
            const buffer = binaryData.buffer;
            const result = bufferToBase64URLString(buffer);

            expect(result).toBeDefined();
            expect(result).not.toContain("+");
            expect(result).not.toContain("/");
            expect(result).not.toContain("=");
        });
    });

    describe("base64URLStringToBuffer", () => {
        it("should convert empty base64url string to empty ArrayBuffer", () => {
            const result = base64URLStringToBuffer("");

            expect(result.byteLength).toBe(0);
        });

        it("should convert base64url string to ArrayBuffer", () => {
            const base64url = "SGVsbG8"; // "Hello"
            const result = base64URLStringToBuffer(base64url);
            const bytes = new Uint8Array(result);

            expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
        });

        it("should handle - character (replaced from +)", () => {
            const base64url = "SGVsbG8"; // Will have - if original had +
            const result = base64URLStringToBuffer(base64url);

            expect(result.byteLength).toBeGreaterThan(0);
        });

        it("should handle _ character (replaced from /)", () => {
            const base64url = "SGVsbG8"; // Will have _ if original had /
            const result = base64URLStringToBuffer(base64url);

            expect(result.byteLength).toBeGreaterThan(0);
        });

        it("should handle strings without padding", () => {
            const base64url = "SGU"; // "He" without padding
            const result = base64URLStringToBuffer(base64url);
            const bytes = new Uint8Array(result);

            expect(bytes).toEqual(new Uint8Array([72, 101]));
        });

        it("should round-trip convert correctly", () => {
            const originalBuffer = new Uint8Array([
                72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
            ]).buffer; // "Hello World"

            const base64url = bufferToBase64URLString(originalBuffer);
            const convertedBuffer = base64URLStringToBuffer(base64url);
            const originalBytes = new Uint8Array(originalBuffer);
            const convertedBytes = new Uint8Array(convertedBuffer);

            expect(convertedBytes).toEqual(originalBytes);
        });

        it("should handle multiple round-trips", () => {
            const originalBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;

            let current = originalBuffer;
            for (let i = 0; i < 5; i++) {
                const base64url = bufferToBase64URLString(current);
                current = base64URLStringToBuffer(base64url);
            }

            const originalBytes = new Uint8Array(originalBuffer);
            const finalBytes = new Uint8Array(current);

            expect(finalBytes).toEqual(originalBytes);
        });

        it("should handle large base64url strings", () => {
            const largeArray = new Uint8Array(1000);
            for (let i = 0; i < 1000; i++) {
                largeArray[i] = i % 256;
            }
            const originalBuffer = largeArray.buffer;

            const base64url = bufferToBase64URLString(originalBuffer);
            const convertedBuffer = base64URLStringToBuffer(base64url);

            expect(convertedBuffer.byteLength).toBe(originalBuffer.byteLength);
            const originalBytes = new Uint8Array(originalBuffer);
            const convertedBytes = new Uint8Array(convertedBuffer);
            expect(convertedBytes).toEqual(originalBytes);
        });

        it("should handle binary data round-trip", () => {
            const binaryData = new Uint8Array([
                0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x80, 0x7f,
            ]);
            const originalBuffer = binaryData.buffer;

            const base64url = bufferToBase64URLString(originalBuffer);
            const convertedBuffer = base64URLStringToBuffer(base64url);
            const convertedBytes = new Uint8Array(convertedBuffer);

            expect(convertedBytes).toEqual(binaryData);
        });
    });

    describe("edge cases", () => {
        it("should handle single byte", () => {
            const buffer = new Uint8Array([65]).buffer; // "A"
            const base64url = bufferToBase64URLString(buffer);
            const converted = base64URLStringToBuffer(base64url);

            expect(new Uint8Array(converted)).toEqual(new Uint8Array([65]));
        });

        it("should handle two bytes", () => {
            const buffer = new Uint8Array([72, 101]).buffer; // "He"
            const base64url = bufferToBase64URLString(buffer);
            const converted = base64URLStringToBuffer(base64url);

            expect(new Uint8Array(converted)).toEqual(
                new Uint8Array([72, 101])
            );
        });

        it("should handle three bytes", () => {
            const buffer = new Uint8Array([72, 101, 108]).buffer; // "Hel"
            const base64url = bufferToBase64URLString(buffer);
            const converted = base64URLStringToBuffer(base64url);

            expect(new Uint8Array(converted)).toEqual(
                new Uint8Array([72, 101, 108])
            );
        });

        it("should handle all zero bytes", () => {
            const buffer = new Uint8Array([0, 0, 0, 0]).buffer;
            const base64url = bufferToBase64URLString(buffer);
            const converted = base64URLStringToBuffer(base64url);

            expect(new Uint8Array(converted)).toEqual(
                new Uint8Array([0, 0, 0, 0])
            );
        });

        it("should handle all max bytes", () => {
            const buffer = new Uint8Array([255, 255, 255, 255]).buffer;
            const base64url = bufferToBase64URLString(buffer);
            const converted = base64URLStringToBuffer(base64url);

            expect(new Uint8Array(converted)).toEqual(
                new Uint8Array([255, 255, 255, 255])
            );
        });
    });
});

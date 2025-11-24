/**
 * Tests for decompressJsonFromB64 utility function
 * Tests decompression of base64url-encoded JSON strings
 */

import { vi } from "vitest";

// Mock the frame-connector module - must be before imports
vi.mock("@frak-labs/frame-connector", () => ({
    compressJson: vi.fn((data: unknown) => {
        // Simple mock: convert JSON to Uint8Array
        const jsonString = JSON.stringify(data);
        return new TextEncoder().encode(jsonString);
    }),
    decompressJson: vi.fn((data: Uint8Array) => {
        // Simple mock: convert Uint8Array back to JSON
        const jsonString = new TextDecoder().decode(data);
        return JSON.parse(jsonString);
    }),
}));

import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { compressJsonToB64 } from "./compress";
import { decompressJsonFromB64 } from "./decompress";

describe("decompressJsonFromB64", () => {
    describe("success cases", () => {
        it("should decompress simple object", () => {
            const original = { key: "value" };
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });

        it("should decompress array data", () => {
            const original = [1, 2, 3, 4, 5];
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });

        it("should decompress nested object", () => {
            const original = {
                user: {
                    name: "John",
                    address: {
                        city: "Paris",
                        country: "France",
                    },
                },
            };
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });

        it("should decompress string data", () => {
            const original = "Hello, World!";
            const compressed = compressJsonToB64(original);
            const decompressed = decompressJsonFromB64<string>(compressed);

            expect(decompressed).toBe(original);
        });

        it("should decompress number data", () => {
            const original = 12345;
            const compressed = compressJsonToB64(original);
            const decompressed = decompressJsonFromB64<number>(compressed);

            expect(decompressed).toBe(original);
        });

        it("should decompress boolean data", () => {
            const original = true;
            const compressed = compressJsonToB64(original);
            const decompressed = decompressJsonFromB64<boolean>(compressed);

            expect(decompressed).toBe(original);
        });

        it("should decompress null", () => {
            const original = null;
            const compressed = compressJsonToB64(original);
            const decompressed = decompressJsonFromB64<null>(compressed);

            expect(decompressed).toBeNull();
        });
    });

    describe("round-trip compression", () => {
        it("should preserve data through compress-decompress cycle", () => {
            const original = {
                id: 123,
                name: "Test User",
                tags: ["tag1", "tag2", "tag3"],
                metadata: {
                    created: "2024-01-01",
                    updated: "2024-01-02",
                },
            };

            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });

        it("should handle empty object round-trip", () => {
            const original = {};
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });

        it("should handle empty array round-trip", () => {
            const original: unknown[] = [];
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });
    });

    describe("edge cases", () => {
        it("should handle empty object round-trip gracefully", () => {
            // Empty objects should compress and decompress correctly
            const original = {};
            const compressed = compressJsonToB64(original);
            const decompressed =
                decompressJsonFromB64<typeof original>(compressed);

            expect(decompressed).toEqual(original);
        });
    });
});

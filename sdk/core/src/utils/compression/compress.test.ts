/**
 * Tests for compressJsonToB64 utility function
 * Tests JSON compression to base64url-encoded string
 */

import { vi } from "vitest";

// Mock the frame-connector module - must be before imports
vi.mock("@frak-labs/frame-connector", () => ({
    compressJson: vi.fn((data: unknown) => {
        // Simple mock: convert JSON to Uint8Array
        const jsonString = JSON.stringify(data);
        return new TextEncoder().encode(jsonString);
    }),
}));

import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { compressJsonToB64 } from "./compress";

describe("compressJsonToB64", () => {
    describe("success cases", () => {
        it("should compress and encode simple object", () => {
            const data = { key: "value" };
            const result = compressJsonToB64(data);

            // Result should be a base64url-encoded string
            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
            // Base64url should not contain +, /, or = characters
            expect(result).not.toMatch(/[+/=]/);
        });

        it("should compress and encode array data", () => {
            const data = [1, 2, 3, 4, 5];
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
            expect(result).not.toMatch(/[+/=]/);
        });

        it("should compress and encode nested object", () => {
            const data = {
                user: {
                    name: "John",
                    address: {
                        city: "Paris",
                        country: "France",
                    },
                },
            };
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });

        it("should compress and encode string data", () => {
            const data = "Hello, World!";
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });

        it("should compress and encode number data", () => {
            const data = 12345;
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });

        it("should compress and encode boolean data", () => {
            const data = true;
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });

        it("should compress and encode null", () => {
            const data = null;
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("edge cases", () => {
        it("should handle empty object", () => {
            const data = {};
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
        });

        it("should handle empty array", () => {
            const data: unknown[] = [];
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
        });

        it("should handle empty string", () => {
            const data = "";
            const result = compressJsonToB64(data);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
        });
    });
});

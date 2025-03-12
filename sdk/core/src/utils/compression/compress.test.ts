import * as lzString from "async-lz-string";
import { sha256 } from "js-sha256";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { compressJson, hashAndCompressData } from "./compress";

// Mock the external compression library functions before test setup
vi.mock("async-lz-string", () => ({
    compressToBase64: vi.fn(),
    decompressFromBase64: vi.fn(),
}));

describe("compression utilities", () => {
    beforeEach(() => {
        // Setup mock implementations in beforeEach so they are reset properly
        vi.mocked(lzString.compressToBase64).mockImplementation(
            async (data: string) => {
                return `compressed:${data}`;
            }
        );

        vi.mocked(lzString.decompressFromBase64).mockImplementation(
            async (data: string) => {
                return data.replace("compressed:", "");
            }
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("compressJson", () => {
        test("should stringify and compress data", async () => {
            const testData = { test: "value", num: 123 };

            const result = await compressJson(testData);

            // Verify the compression function was called with stringified data
            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(testData)
            );

            // Verify we get the expected result from our mock
            expect(result).toBe(`compressed:${JSON.stringify(testData)}`);
        });

        test("should handle empty objects", async () => {
            const result = await compressJson({});

            expect(lzString.compressToBase64).toHaveBeenCalledWith("{}");
            expect(result).toBe("compressed:{}");
        });

        test("should handle arrays", async () => {
            const testArray = [1, 2, "test"];

            const result = await compressJson(testArray);

            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(testArray)
            );
            expect(result).toBe(`compressed:${JSON.stringify(testArray)}`);
        });

        test("should handle primitive values", async () => {
            const testString = "just a string";

            const result = await compressJson(testString);

            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(testString)
            );
            expect(result).toBe(`compressed:"${testString}"`);
        });
    });

    describe("hashAndCompressData", () => {
        test("should add validation hash to data before compression", async () => {
            const testData = { name: "Test", value: 42 };
            const expectedHash = sha256(JSON.stringify(testData));

            const result = await hashAndCompressData(testData);

            // Check that the compression function was called with the expected hash-protected data
            const expectedHashProtectedData = {
                ...testData,
                validationHash: expectedHash,
            };

            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(expectedHashProtectedData)
            );

            // Verify the returned data format
            expect(result).toHaveProperty("compressed");
            expect(result).toHaveProperty("compressedHash");

            // The compressed value should be our mock result
            expect(result.compressed).toBe(
                `compressed:${JSON.stringify(expectedHashProtectedData)}`
            );

            // The compressedHash should be the SHA-256 hash of the compressed data
            expect(result.compressedHash).toBe(sha256(result.compressed));
        });

        test("should handle empty objects", async () => {
            const emptyObject = {};
            const expectedHash = sha256(JSON.stringify(emptyObject));

            const result = await hashAndCompressData(emptyObject);

            const expectedData = { validationHash: expectedHash };
            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(expectedData)
            );
            expect(result.compressedHash).toBe(sha256(result.compressed));
        });

        test("should handle complex nested objects", async () => {
            const complexData = {
                user: {
                    name: "Test User",
                    preferences: {
                        theme: "dark",
                        notifications: true,
                    },
                },
                items: [
                    { id: 1, value: "first" },
                    { id: 2, value: "second" },
                ],
            };

            const expectedHash = sha256(JSON.stringify(complexData));

            const result = await hashAndCompressData(complexData);

            const expectedData = {
                ...complexData,
                validationHash: expectedHash,
            };

            expect(lzString.compressToBase64).toHaveBeenCalledWith(
                JSON.stringify(expectedData)
            );
            expect(result.compressedHash).toBe(sha256(result.compressed));
        });

        test("should create different hashes for different inputs", async () => {
            const data1 = { test: "value1" };
            const data2 = { test: "value2" };

            const result1 = await hashAndCompressData(data1);
            const result2 = await hashAndCompressData(data2);

            // The validation hashes should be different
            expect(sha256(JSON.stringify(data1))).not.toBe(
                sha256(JSON.stringify(data2))
            );

            // The compressed data should be different
            expect(result1.compressed).not.toBe(result2.compressed);

            // The compressed hashes should be different
            expect(result1.compressedHash).not.toBe(result2.compressedHash);
        });
    });

    // Test the full compression and decompression cycle
    describe("compression and decompression cycle", () => {
        test("should be able to decompress compressed data", async () => {
            // For this test, we'll simulate a real compression/decompression cycle
            // using our mocks rather than attempting to use the real implementation
            const testData = {
                name: "Test Compression Cycle",
                value: Math.random(),
            };

            // Temporarily change our mock implementations to simulate a real cycle
            // The compressToBase64 function will just stringify the data
            vi.mocked(lzString.compressToBase64).mockImplementation(
                async (data: string) => {
                    return data; // Just return the data directly for this test
                }
            );

            // The decompressFromBase64 function will just return the same data
            vi.mocked(lzString.decompressFromBase64).mockImplementation(
                async (data: string) => {
                    return data; // Just return the data directly for this test
                }
            );

            // Use the compressJson function with our modified mocks
            const compressed = await compressJson(testData);

            // The compressed result should be the stringified data
            expect(compressed).toBe(JSON.stringify(testData));

            // Now decompress it with our modified mock
            const decompressed =
                await lzString.decompressFromBase64(compressed);

            // The decompressed result should be the same as the compressed
            expect(decompressed).toBe(JSON.stringify(testData));

            // Parse and check that we got our original data back
            expect(JSON.parse(decompressed as string)).toEqual(testData);
        });
    });
});

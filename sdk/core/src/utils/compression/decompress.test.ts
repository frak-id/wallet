import * as lzString from "async-lz-string";
import { sha256 } from "js-sha256";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FrakRpcError, RpcErrorCodes } from "../../types";
import type {
    CompressedData,
    HashProtectedData,
} from "../../types/compression";
import { hashAndCompressData } from "./compress";
import { decompressDataAndCheckHash, decompressJson } from "./decompress";

// Mock the external compression library functions before test setup
vi.mock("async-lz-string", () => ({
    compressToBase64: vi.fn(),
    decompressFromBase64: vi.fn(),
}));

describe("decompression utilities", () => {
    // Spy on console.error to suppress and test error logging
    const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

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

        consoleErrorSpy.mockClear();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("decompressJson", () => {
        test("should decompress and parse valid JSON data", async () => {
            const originalObject = { test: "value", num: 123 };
            const compressedString = `compressed:${JSON.stringify(originalObject)}`;

            const result = await decompressJson(compressedString);

            expect(lzString.decompressFromBase64).toHaveBeenCalledWith(
                compressedString
            );
            expect(result).toEqual(originalObject);
        });

        test("should return null for invalid JSON data", async () => {
            // Mock decompressFromBase64 to return invalid JSON for this test
            vi.mocked(lzString.decompressFromBase64).mockResolvedValueOnce(
                "invalid json"
            );

            const result = await decompressJson("some-compressed-data");

            expect(lzString.decompressFromBase64).toHaveBeenCalledWith(
                "some-compressed-data"
            );
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Invalid compressed data",
                expect.objectContaining({
                    e: expect.any(Error),
                    decompressed: "invalid json",
                })
            );
        });
    });

    describe("decompressDataAndCheckHash", () => {
        test("should successfully decompress and validate data with correct hashes", async () => {
            // First create valid compressed data
            const originalData = { name: "Test", value: 42 };
            const compressedData = await hashAndCompressData(originalData);

            // Now decompress and validate it
            const result =
                await decompressDataAndCheckHash<typeof originalData>(
                    compressedData
                );

            // Should include our original data
            expect(result).toMatchObject(originalData);

            // Should also have the validation hash
            expect(result).toHaveProperty("validationHash");

            // Validation hash should match the hash of the original data
            const { validationHash, ...rawData } = result;
            expect(validationHash).toBe(sha256(JSON.stringify(rawData)));
        });

        test("should throw error if compressed data is missing", async () => {
            // Using null for empty object to avoid TypeScript errors
            await expect(
                decompressDataAndCheckHash(null as unknown as CompressedData)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Missing compressed data"
                )
            );

            // Missing compressedHash
            const missingHash = {
                compressed: "data",
            } as unknown as CompressedData;
            await expect(
                decompressDataAndCheckHash(missingHash)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Missing compressed data"
                )
            );

            // Missing compressed
            const missingCompressed = {
                compressedHash: "hash",
            } as unknown as CompressedData;
            await expect(
                decompressDataAndCheckHash(missingCompressed)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Missing compressed data"
                )
            );
        });

        test("should throw error if decompressed data is invalid", async () => {
            // Create a compressed payload but make the decompression fail
            vi.mocked(lzString.decompressFromBase64).mockResolvedValueOnce(
                "invalid json"
            );

            const compressedData: CompressedData = {
                compressed: "some-data",
                compressedHash: sha256("some-data"),
            };

            await expect(
                decompressDataAndCheckHash(compressedData)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Invalid compressed data"
                )
            );

            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        test("should throw error if validation hash is missing", async () => {
            // Create data that will decompress correctly but is missing validationHash
            const dataWithNoHash = { test: "value" };

            // Mock decompression to return our invalid data
            vi.mocked(lzString.decompressFromBase64).mockResolvedValueOnce(
                JSON.stringify(dataWithNoHash)
            );

            const compressedData: CompressedData = {
                compressed: "some-data",
                compressedHash: sha256("some-data"),
            };

            await expect(
                decompressDataAndCheckHash(compressedData)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Missing validation hash"
                )
            );
        });

        test("should throw error if compressed hash is invalid", async () => {
            // Create valid data but with wrong compressedHash
            const originalData = { name: "Test", value: 42 };
            const compressedData = await hashAndCompressData(originalData);

            // Tamper with the hash
            const tamperedData: CompressedData = {
                ...compressedData,
                compressedHash: "wrong-hash",
            };

            await expect(
                decompressDataAndCheckHash(tamperedData)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Invalid compressed hash"
                )
            );
        });

        test("should throw error if validation hash is invalid", async () => {
            // Create a payload with incorrect validation hash
            const originalData = { name: "Test", value: 42 };

            // Create a HashProtectedData with wrong validation hash
            const tamperedProtectedData: HashProtectedData<
                typeof originalData
            > = {
                ...originalData,
                validationHash: "wrong-hash", // This should not match the data
            };

            // Mock decompression to return our tampered data
            vi.mocked(lzString.decompressFromBase64).mockResolvedValueOnce(
                JSON.stringify(tamperedProtectedData)
            );

            const compressedData: CompressedData = {
                compressed: "some-data",
                compressedHash: sha256("some-data"), // This hash is correct for our purposes
            };

            await expect(
                decompressDataAndCheckHash(compressedData)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Invalid data validation hash"
                )
            );
        });
    });

    describe("end-to-end compress and decompress", () => {
        test("should correctly round-trip data through compression and decompression", async () => {
            // Use our simplified compress/decompress cycle for testing
            vi.mocked(lzString.compressToBase64).mockImplementation(
                async (data: string) => data
            );
            vi.mocked(lzString.decompressFromBase64).mockImplementation(
                async (data: string) => data
            );

            const originalData = {
                name: "Round Trip Test",
                nested: {
                    value: 42,
                    array: [1, 2, 3],
                },
                bool: true,
            };

            // Compress the data
            const compressed = await hashAndCompressData(originalData);

            // Decompress the data
            const decompressed =
                await decompressDataAndCheckHash<typeof originalData>(
                    compressed
                );

            // Check original properties are preserved (excluding validationHash)
            const { validationHash, ...extractedData } = decompressed;
            expect(extractedData).toEqual(originalData);

            // validationHash should also match what we'd expect
            expect(validationHash).toBe(sha256(JSON.stringify(originalData)));
        });

        test("should detect tampering with compressed data", async () => {
            // Use our simplified compress/decompress cycle for testing
            vi.mocked(lzString.compressToBase64).mockImplementation(
                async (data: string) => data
            );
            vi.mocked(lzString.decompressFromBase64).mockImplementation(
                async (data: string) => data
            );

            const originalData = { sensitive: "top-secret", value: 123 };

            // Compress the data
            const compressed = await hashAndCompressData(originalData);

            // Tamper with the compressed string
            const tamperedCompressed: CompressedData = {
                ...compressed,
                compressed: compressed.compressed.replace("123", "456"),
            };

            // Attempt to decompress the tampered data should fail
            await expect(
                decompressDataAndCheckHash(tamperedCompressed)
            ).rejects.toThrow(
                new FrakRpcError(
                    RpcErrorCodes.corruptedResponse,
                    "Invalid compressed hash"
                )
            );
        });
    });
});

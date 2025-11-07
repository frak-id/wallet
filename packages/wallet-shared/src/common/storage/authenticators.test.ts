import * as idbKeyval from "idb-keyval";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatorStorage } from "./authenticators";
import type { PreviousAuthenticatorModel } from "./PreviousAuthenticatorModel";

// Mock idb-keyval
vi.mock("idb-keyval", () => ({
    get: vi.fn(),
    set: vi.fn(),
    createStore: vi.fn(() => ({})), // Return a mock store object
}));

describe("authenticatorStorage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("put", () => {
        it("should add an authenticator to an empty store", async () => {
            const mockAuthenticator: PreviousAuthenticatorModel = {
                wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
                authenticatorId: "auth-1",
            };

            vi.mocked(idbKeyval.get).mockResolvedValue(undefined);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await authenticatorStorage.put(mockAuthenticator);

            expect(idbKeyval.get).toHaveBeenCalledWith(
                "previous-authenticators",
                expect.anything()
            );
            expect(idbKeyval.set).toHaveBeenCalledWith(
                "previous-authenticators",
                [mockAuthenticator],
                expect.anything()
            );
        });

        it("should add an authenticator to existing authenticators", async () => {
            const existing: PreviousAuthenticatorModel[] = [
                {
                    wallet: "0x1111111111111111111111111111111111111111" as `0x${string}`,
                    authenticatorId: "auth-1",
                },
            ];

            const newAuthenticator: PreviousAuthenticatorModel = {
                wallet: "0x2222222222222222222222222222222222222222" as `0x${string}`,
                authenticatorId: "auth-2",
            };

            vi.mocked(idbKeyval.get).mockResolvedValue(existing);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await authenticatorStorage.put(newAuthenticator);

            expect(idbKeyval.set).toHaveBeenCalledWith(
                "previous-authenticators",
                [...existing, newAuthenticator],
                expect.anything()
            );
        });

        it("should replace existing authenticator with same wallet address (primary key behavior)", async () => {
            const walletAddress =
                "0x1234567890123456789012345678901234567890" as `0x${string}`;

            const existing: PreviousAuthenticatorModel[] = [
                {
                    wallet: walletAddress,
                    authenticatorId: "old-auth-id",
                    transports: ["usb"],
                },
                {
                    wallet: "0x9999999999999999999999999999999999999999" as `0x${string}`,
                    authenticatorId: "different-wallet",
                },
            ];

            const updatedAuthenticator: PreviousAuthenticatorModel = {
                wallet: walletAddress,
                authenticatorId: "new-auth-id",
                transports: ["internal"],
            };

            vi.mocked(idbKeyval.get).mockResolvedValue(existing);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await authenticatorStorage.put(updatedAuthenticator);

            expect(idbKeyval.set).toHaveBeenCalledWith(
                "previous-authenticators",
                [
                    existing[1], // Different wallet preserved
                    updatedAuthenticator, // New one replaces old
                ],
                expect.anything()
            );
        });

        it("should handle null as empty array", async () => {
            const mockAuthenticator: PreviousAuthenticatorModel = {
                wallet: "0x1234567890123456789012345678901234567890" as `0x${string}`,
                authenticatorId: "auth-1",
            };

            vi.mocked(idbKeyval.get).mockResolvedValue(null);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await authenticatorStorage.put(mockAuthenticator);

            expect(idbKeyval.set).toHaveBeenCalledWith(
                "previous-authenticators",
                [mockAuthenticator],
                expect.anything()
            );
        });

        it("should preserve transports when updating authenticator", async () => {
            const walletAddress =
                "0x1234567890123456789012345678901234567890" as `0x${string}`;

            const existing: PreviousAuthenticatorModel[] = [
                {
                    wallet: walletAddress,
                    authenticatorId: "old-auth",
                },
            ];

            const updatedAuthenticator: PreviousAuthenticatorModel = {
                wallet: walletAddress,
                authenticatorId: "new-auth",
                transports: ["usb", "nfc"],
            };

            vi.mocked(idbKeyval.get).mockResolvedValue(existing);
            vi.mocked(idbKeyval.set).mockResolvedValue(undefined);

            await authenticatorStorage.put(updatedAuthenticator);

            const savedData = vi.mocked(idbKeyval.set).mock
                .calls[0][1] as PreviousAuthenticatorModel[];
            expect(savedData[0]).toEqual(updatedAuthenticator);
            expect(savedData[0].transports).toEqual(["usb", "nfc"]);
        });
    });

    describe("getAll", () => {
        it("should return all authenticators", async () => {
            const authenticators: PreviousAuthenticatorModel[] = [
                {
                    wallet: "0x1111111111111111111111111111111111111111" as `0x${string}`,
                    authenticatorId: "auth-1",
                },
                {
                    wallet: "0x2222222222222222222222222222222222222222" as `0x${string}`,
                    authenticatorId: "auth-2",
                },
            ];

            vi.mocked(idbKeyval.get).mockResolvedValue(authenticators);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual(authenticators);
        });

        it("should return empty array when no authenticators exist", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue(undefined);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should return empty array when store returns null", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue(null);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should handle NotFoundError gracefully", async () => {
            const notFoundError = new DOMException(
                "Store not found",
                "NotFoundError"
            );
            vi.mocked(idbKeyval.get).mockRejectedValue(notFoundError);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should handle other errors gracefully and log them", async () => {
            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});
            const unexpectedError = new Error("Unexpected error");
            vi.mocked(idbKeyval.get).mockRejectedValue(unexpectedError);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get authenticators:",
                unexpectedError
            );

            consoleErrorSpy.mockRestore();
        });

        it("should return empty array for empty store", async () => {
            vi.mocked(idbKeyval.get).mockResolvedValue([]);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        it("should preserve authenticator transports in returned data", async () => {
            const authenticators: PreviousAuthenticatorModel[] = [
                {
                    wallet: "0x1111111111111111111111111111111111111111" as `0x${string}`,
                    authenticatorId: "auth-1",
                    transports: ["usb", "nfc"],
                },
            ];

            vi.mocked(idbKeyval.get).mockResolvedValue(authenticators);

            const result = await authenticatorStorage.getAll();

            expect(result[0].transports).toEqual(["usb", "nfc"]);
        });
    });
});

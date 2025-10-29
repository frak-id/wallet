import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { PreviousAuthenticatorModel } from "./PreviousAuthenticatorModel";

// Mock idb-keyval
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockCreateStore = vi.fn(() => "mock-store");

vi.mock("idb-keyval", () => ({
    get: mockGet,
    set: mockSet,
    createStore: mockCreateStore,
}));

describe("authenticatorStorage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("put", () => {
        test("should add new authenticator when none exist", async ({
            mockAddress,
        }) => {
            const { authenticatorStorage } = await import("./authenticators");

            const mockAuthenticator: PreviousAuthenticatorModel = {
                wallet: mockAddress,
                authenticatorId: "auth-123",
                transports: ["internal"],
            };

            mockGet.mockResolvedValue(null);
            mockSet.mockResolvedValue(undefined);

            await authenticatorStorage.put(mockAuthenticator);

            expect(mockSet).toHaveBeenCalledWith(
                "previous-authenticators",
                [mockAuthenticator],
                "mock-store"
            );
        });

        test("should replace existing authenticator for same wallet", async ({
            mockAddress,
        }) => {
            const { authenticatorStorage } = await import("./authenticators");

            const mockWallet = mockAddress;
            const existing: PreviousAuthenticatorModel = {
                wallet: mockWallet,
                authenticatorId: "old-auth",
                transports: ["usb"],
            };

            const updated: PreviousAuthenticatorModel = {
                wallet: mockWallet,
                authenticatorId: "new-auth",
                transports: ["internal"],
            };

            mockGet.mockResolvedValue([existing]);
            mockSet.mockResolvedValue(undefined);

            await authenticatorStorage.put(updated);

            expect(mockSet).toHaveBeenCalledWith(
                "previous-authenticators",
                [updated],
                "mock-store"
            );
        });

        test("should add to existing authenticators for different wallet", async () => {
            const { authenticatorStorage } = await import("./authenticators");
            const { createMockAddress } = await import("../../test/factories");

            const existing: PreviousAuthenticatorModel = {
                wallet: createMockAddress("1111"),
                authenticatorId: "auth-1",
                transports: ["usb"],
            };

            const newAuth: PreviousAuthenticatorModel = {
                wallet: createMockAddress("2222"),
                authenticatorId: "auth-2",
                transports: ["internal"],
            };

            mockGet.mockResolvedValue([existing]);
            mockSet.mockResolvedValue(undefined);

            await authenticatorStorage.put(newAuth);

            expect(mockSet).toHaveBeenCalledWith(
                "previous-authenticators",
                [existing, newAuth],
                "mock-store"
            );
        });
    });

    describe("getAll", () => {
        test("should return empty array when no authenticators exist", async () => {
            const { authenticatorStorage } = await import("./authenticators");

            mockGet.mockResolvedValue(null);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        test("should return all authenticators", async () => {
            const { authenticatorStorage } = await import("./authenticators");
            const { createMockAddress } = await import("../../test/factories");

            const mockAuthenticators: PreviousAuthenticatorModel[] = [
                {
                    wallet: createMockAddress("1111"),
                    authenticatorId: "auth-1",
                    transports: ["usb"],
                },
                {
                    wallet: createMockAddress("2222"),
                    authenticatorId: "auth-2",
                    transports: ["internal"],
                },
            ];

            mockGet.mockResolvedValue(mockAuthenticators);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual(mockAuthenticators);
        });

        test("should handle NotFoundError and return empty array", async () => {
            const { authenticatorStorage } = await import("./authenticators");

            const notFoundError = new DOMException(
                "Store not found",
                "NotFoundError"
            );
            mockGet.mockRejectedValue(notFoundError);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
        });

        test("should log and return empty array on unexpected errors", async () => {
            const { authenticatorStorage } = await import("./authenticators");

            const consoleErrorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const unexpectedError = new Error("Unexpected error");
            mockGet.mockRejectedValue(unexpectedError);

            const result = await authenticatorStorage.getAll();

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Failed to get authenticators:",
                unexpectedError
            );

            consoleErrorSpy.mockRestore();
        });
    });
});

import { WebAuthN } from "@frak-labs/app-essentials";
import * as simplewebauthn from "@simplewebauthn/server";
import type { Hex } from "viem";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { getSignOptions } from "./signOptions";

// Mock dependencies
vi.mock("@simplewebauthn/server", () => ({
    generateAuthenticationOptions: vi.fn(),
}));

describe("getSignOptions", () => {
    const mockAuthenticatorId = "mock-authenticator-id";
    const mockToSign =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
    const mockAuthenticationOptions = {
        challenge: "mock-challenge",
        rpId: "frak.id",
        allowCredentials: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock generateAuthenticationOptions
        vi.mocked(
            simplewebauthn.generateAuthenticationOptions
        ).mockResolvedValue(mockAuthenticationOptions as any);
    });

    test("should generate authentication options with authenticatorId", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                allowCredentials: [
                    {
                        id: mockAuthenticatorId,
                        transports: undefined,
                    },
                ],
            })
        );
    });

    test("should convert toSign hex to bytes for challenge", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        // Verify challenge was passed as Uint8Array
        const call = vi.mocked(simplewebauthn.generateAuthenticationOptions)
            .mock.calls[0][0];
        expect(call.challenge).toBeInstanceOf(Uint8Array);
    });

    test("should use WebAuthN rpId configuration", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                rpID: WebAuthN.rpId,
            })
        );
    });

    test("should set userVerification to required", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                userVerification: "required",
            })
        );
    });

    test("should set timeout to 180 seconds", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                timeout: 180_000,
            })
        );
    });

    test("should include transports when provided", async () => {
        const transports = ["usb", "nfc", "internal"];

        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
            transports,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                allowCredentials: [
                    {
                        id: mockAuthenticatorId,
                        transports: ["usb", "nfc", "internal"],
                    },
                ],
            })
        );
    });

    test("should set transports to undefined when not provided", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                allowCredentials: [
                    {
                        id: mockAuthenticatorId,
                        transports: undefined,
                    },
                ],
            })
        );
    });

    test("should return the result from generateAuthenticationOptions", async () => {
        const result = await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
        });

        expect(result).toBe(mockAuthenticationOptions);
    });

    test("should handle different hex values for toSign", async () => {
        const differentToSign =
            "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;

        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: differentToSign,
        });

        // Verify challenge is a Uint8Array (converted from hex)
        const call = vi.mocked(simplewebauthn.generateAuthenticationOptions)
            .mock.calls[0][0];
        expect(call.challenge).toBeInstanceOf(Uint8Array);
    });

    test("should handle empty transports array", async () => {
        await getSignOptions({
            authenticatorId: mockAuthenticatorId,
            toSign: mockToSign,
            transports: [],
        });

        expect(
            simplewebauthn.generateAuthenticationOptions
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                allowCredentials: [
                    {
                        id: mockAuthenticatorId,
                        transports: [],
                    },
                ],
            })
        );
    });
});

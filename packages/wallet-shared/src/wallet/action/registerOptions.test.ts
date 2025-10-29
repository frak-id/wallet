import { WebAuthN } from "@frak-labs/app-essentials";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import * as simplewebauthn from "@simplewebauthn/server";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { getRegisterOptions } from "./registerOptions";

// Mock dependencies
vi.mock("@simplewebauthn/server", () => ({
    generateRegistrationOptions: vi.fn(),
}));

describe("getRegisterOptions", () => {
    const mockRegistrationOptions = {
        challenge: "mock-challenge",
        rp: { name: "Frak", id: "frak.id" },
        user: {
            id: new Uint8Array(),
            name: "test-user",
            displayName: "test-user",
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock generateRegistrationOptions
        vi.mocked(simplewebauthn.generateRegistrationOptions).mockResolvedValue(
            mockRegistrationOptions as any
        );
    });

    test("should generate registration options with date-based username", async () => {
        const date = new Date();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString();
        const expectedUsername = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                userName: expectedUsername,
                userDisplayName: expectedUsername,
            })
        );
    });

    test("should generate user ID from random bytes", async () => {
        await getRegisterOptions();

        // Verify generateRegistrationOptions was called with a userID
        const call = vi.mocked(simplewebauthn.generateRegistrationOptions).mock
            .calls[0][0];
        expect(call.userID).toBeInstanceOf(Uint8Array);
    });

    test("should use WebAuthN configuration values", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                rpName: WebAuthN.rpName,
                rpID: WebAuthN.rpId,
            })
        );
    });

    test("should set authenticatorAttachment to cross-platform when crossPlatform is true", async () => {
        await getRegisterOptions({ crossPlatform: true });

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                authenticatorSelection: expect.objectContaining({
                    authenticatorAttachment: "cross-platform",
                }),
            })
        );
    });

    test("should set authenticatorAttachment to undefined when crossPlatform is false", async () => {
        await getRegisterOptions({ crossPlatform: false });

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                authenticatorSelection: expect.objectContaining({
                    authenticatorAttachment: undefined,
                }),
            })
        );
    });

    test("should use default crossPlatform value of false when not provided", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                authenticatorSelection: expect.objectContaining({
                    authenticatorAttachment: undefined,
                }),
            })
        );
    });

    test("should map excludeCredentials with id and transports", async () => {
        const excludeCredentials = [
            {
                id: "credential-1" as Base64URLString,
                transports: ["usb", "nfc"] as AuthenticatorTransportFuture[],
            },
            {
                id: "credential-2" as Base64URLString,
                transports: ["internal"] as AuthenticatorTransportFuture[],
            },
        ];

        await getRegisterOptions({ excludeCredentials });

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeCredentials: [
                    { id: "credential-1", transports: ["usb", "nfc"] },
                    { id: "credential-2", transports: ["internal"] },
                ],
            })
        );
    });

    test("should use empty array for excludeCredentials when not provided", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeCredentials: [],
            })
        );
    });

    test("should set required authenticator selection options", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                authenticatorSelection: {
                    requireResidentKey: true,
                    authenticatorAttachment: undefined,
                    userVerification: "required",
                },
            })
        );
    });

    test("should set timeout to 180 seconds", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                timeout: 180_000,
            })
        );
    });

    test("should set attestationType to direct", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                attestationType: "direct",
            })
        );
    });

    test("should support ES256 algorithm (-7)", async () => {
        await getRegisterOptions();

        expect(simplewebauthn.generateRegistrationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                supportedAlgorithmIDs: [-7],
            })
        );
    });

    test("should return the result from generateRegistrationOptions", async () => {
        const result = await getRegisterOptions();

        expect(result).toBe(mockRegistrationOptions);
    });
});

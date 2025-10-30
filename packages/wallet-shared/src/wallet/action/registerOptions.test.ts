import { WebAuthN } from "@frak-labs/app-essentials";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { getRegisterOptions } from "./registerOptions";

// Mock dependencies
vi.mock("ox", () => ({
    WebAuthnP256: {
        getCredentialCreationOptions: vi.fn(),
    },
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

    beforeEach(async () => {
        vi.clearAllMocks();

        // Mock ox WebAuthnP256.getCredentialCreationOptions
        const { WebAuthnP256 } = await import("ox");
        vi.mocked(WebAuthnP256.getCredentialCreationOptions).mockReturnValue(
            mockRegistrationOptions as any
        );
    });

    test("should call ox WebAuthnP256.getCredentialCreationOptions with correct parameters", async () => {
        const { WebAuthnP256 } = await import("ox");
        const date = new Date();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString();
        const expectedUsername = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

        await getRegisterOptions();

        expect(WebAuthnP256.getCredentialCreationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                rp: {
                    id: WebAuthN.rpId,
                    name: WebAuthN.rpName,
                },
                user: expect.objectContaining({
                    name: expectedUsername,
                    displayName: expectedUsername,
                }),
                timeout: 180_000,
                attestation: "direct",
                authenticatorSelection: {
                    residentKey: "required",
                    authenticatorAttachment: undefined,
                    userVerification: "required",
                },
            })
        );
    });

    test("should set authenticatorAttachment to cross-platform when crossPlatform is true", async () => {
        const { WebAuthnP256 } = await import("ox");

        await getRegisterOptions();

        expect(WebAuthnP256.getCredentialCreationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                authenticatorSelection: expect.objectContaining({
                    authenticatorAttachment: "cross-platform",
                }),
            })
        );
    });

    test("should handle excludeCredentials", async () => {
        const { WebAuthnP256 } = await import("ox");
        const excludeCredentials = [
            {
                id: "credential-1",
                transports: ["usb", "nfc"] as AuthenticatorTransport[],
            },
            {
                id: "credential-2",
                transports: ["internal"] as AuthenticatorTransport[],
            },
        ];

        await getRegisterOptions({ excludeCredentials });

        expect(WebAuthnP256.getCredentialCreationOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                excludeCredentialIds: ["credential-1", "credential-2"],
            })
        );
    });

    test("should return the result from ox", async () => {
        const result = await getRegisterOptions();

        expect(result).toBe(mockRegistrationOptions);
    });
});

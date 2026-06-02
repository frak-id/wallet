import { describe, expect, it } from "vitest";
import {
    CredentialManagerError,
    classifyNativeWebauthnError,
    getWebauthnErrorDetails,
} from "./errors";

function pluginPayload(fields: {
    exceptionClass?: string;
    type?: string;
    message?: string;
}): string {
    return JSON.stringify({ source: "frak-webauthn-plugin", ...fields });
}

describe("classifyNativeWebauthnError", () => {
    it("classifies the raw folsom message (get path) as passkey-sync-failed", () => {
        const details = classifyNativeWebauthnError(
            pluginPayload({
                exceptionClass: "GetCredentialUnknownException",
                message: "Unsuccessful result from folsom activity.",
            })
        );
        expect(details.code).toBe("passkey-sync-failed");
        expect(details.retryable).toBe(false);
        expect(details.gpsCode).toBe("50162");
        expect(details.exceptionClass).toBe("GetCredentialUnknownException");
    });

    it("classifies a [50162] create-path TYPE_NOT_ALLOWED_ERROR as passkey-sync-failed", () => {
        const details = classifyNativeWebauthnError(
            pluginPayload({
                exceptionClass: "CreatePublicKeyCredentialDomException",
                type: "androidx.credentials.TYPE_NOT_ALLOWED_ERROR",
                message:
                    "[50162] Can't find proper key to decrypt the private key from WebauthnCredentialSpecifics",
            })
        );
        expect(details.code).toBe("passkey-sync-failed");
        expect(details.gpsCode).toBe("50162");
        expect(details.nativeType).toBe(
            "androidx.credentials.TYPE_NOT_ALLOWED_ERROR"
        );
    });

    it("classifies TYPE_NO_CREDENTIAL as no-credential", () => {
        const details = classifyNativeWebauthnError(
            pluginPayload({
                exceptionClass: "NoCredentialException",
                type: "androidx.credentials.TYPE_NO_CREDENTIAL",
                message: "No credentials available",
            })
        );
        expect(details.code).toBe("no-credential");
        expect(details.retryable).toBe(false);
    });

    it("classifies a missing provider as provider-unavailable", () => {
        const details = classifyNativeWebauthnError(
            pluginPayload({
                exceptionClass: "CreateCredentialNoCreateOptionException",
                type: "androidx.credentials.TYPE_NO_CREATE_OPTIONS",
                message: "No create options available",
            })
        );
        expect(details.code).toBe("provider-unavailable");
    });

    it("falls back to retryable unknown for unrecognised failures", () => {
        const details = classifyNativeWebauthnError(
            pluginPayload({
                exceptionClass: "CreateCredentialUnknownException",
                message: "Something transient happened",
            })
        );
        expect(details.code).toBe("unknown");
        expect(details.retryable).toBe(true);
    });

    it("handles plain (non-structured) messages", () => {
        const details = classifyNativeWebauthnError(
            "Unsuccessful result from folsom activity."
        );
        expect(details.code).toBe("passkey-sync-failed");
        expect(details.exceptionClass).toBeUndefined();
    });
});

describe("getWebauthnErrorDetails", () => {
    it("recovers details from a wrapped cause chain", () => {
        const native = new CredentialManagerError(
            classifyNativeWebauthnError(
                "Unsuccessful result from folsom activity."
            )
        );
        const bridge = new Error("Tauri get credential error");
        bridge.cause = native;
        const ox = new Error("Failed to request credential.");
        ox.name = "Authentication.SignFailedError";
        ox.cause = bridge;

        expect(getWebauthnErrorDetails(ox)?.code).toBe("passkey-sync-failed");
    });

    it("returns null when no structured details are present", () => {
        const error = new Error("Some unrelated error");
        expect(getWebauthnErrorDetails(error)).toBeNull();
    });
});

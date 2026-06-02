import { describe, expect, it } from "vitest";
import {
    classifyWebauthnError,
    isAuthenticatorAlreadyRegistered,
    isReportableWebauthnError,
    isUserCancellation,
    parseNativeWebauthnError,
    webauthnErrorContext,
} from "./errors";

const ANDROID_NOT_ALLOWED = "androidx.credentials.TYPE_NOT_ALLOWED_ERROR";

function androidEnvelope(type: string | undefined, message: string): string {
    return JSON.stringify(type ? { type, message } : { message });
}

/** ox wraps a `createFn`/`getFn` throw in CreateFailedError/SignFailedError with `.cause`. */
function oxWrapped(name: string, cause: Error): Error {
    const err = new Error("Failed to request credential.");
    err.name = name;
    err.cause = cause;
    return err;
}

/** Web path: a real DOMException-shaped error surfaced as the ox `.cause`. */
function webError(name: string, message = "dom"): Error {
    return oxWrapped("Authentication.SignFailedError", domError(name, message));
}

function domError(name: string, message: string): Error {
    const err = new Error(message);
    err.name = name;
    return err;
}

/** Native path: bridge normalises the reject → plain Error(.name/.gpsCode), then ox wraps. */
function nativeError(raw: string): Error {
    const { name, gpsCode, message } = parseNativeWebauthnError(raw);
    const e = new Error(message) as Error & { gpsCode?: string };
    if (name) e.name = name;
    if (gpsCode) e.gpsCode = gpsCode;
    return oxWrapped("Registration.CreateFailedError", e);
}

describe("parseNativeWebauthnError", () => {
    it("extracts name + gpsCode from an Android create-path envelope", () => {
        const parsed = parseNativeWebauthnError(
            androidEnvelope(
                ANDROID_NOT_ALLOWED,
                "[50162] Can't find proper key to decrypt the private key"
            )
        );
        expect(parsed.name).toBe("NotAllowedError");
        expect(parsed.gpsCode).toBe("50162");
    });

    it("maps a bare iOS DOMException-name reject", () => {
        expect(parseNativeWebauthnError("NotAllowedError").name).toBe(
            "NotAllowedError"
        );
        expect(parseNativeWebauthnError("InvalidStateError").name).toBe(
            "InvalidStateError"
        );
    });

    it("leaves an opaque message unclassified", () => {
        const parsed = parseNativeWebauthnError("Missing 'options' parameter");
        expect(parsed.name).toBeUndefined();
        expect(parsed.gpsCode).toBeUndefined();
    });
});

describe("classifyWebauthnError — web DOMExceptions", () => {
    it.each([
        ["NotAllowedError", "cancelled", true],
        ["AbortError", "cancelled", true],
        ["InvalidStateError", "already-registered", false],
        ["ConstraintError", "no-screen-lock", true],
        ["NotSupportedError", "unsupported", false],
        ["SecurityError", "security", false],
        ["UnknownError", "unknown", true],
    ] as const)("maps %s → %s", (name, kind, retryable) => {
        const result = classifyWebauthnError(webError(name));
        expect(result.kind).toBe(kind);
        expect(result.retryable).toBe(retryable);
    });
});

describe("classifyWebauthnError — Android GPS", () => {
    it("classifies a [50162] create-path folsom failure as sync-failed", () => {
        const result = classifyWebauthnError(
            nativeError(
                androidEnvelope(
                    ANDROID_NOT_ALLOWED,
                    "[50162] Can't find proper key to decrypt the private key"
                )
            )
        );
        expect(result.kind).toBe("sync-failed");
        expect(result.gpsCode).toBe("50162");
        expect(result.name).toBe("NotAllowedError");
    });

    it("classifies the get-path folsom message (no code) as sync-failed", () => {
        const result = classifyWebauthnError(
            nativeError(
                androidEnvelope(
                    ANDROID_NOT_ALLOWED,
                    "Unsuccessful result from folsom activity."
                )
            )
        );
        expect(result.kind).toBe("sync-failed");
    });

    it("classifies [50166] / TYPE_CONSTRAINT as no-screen-lock", () => {
        expect(
            classifyWebauthnError(
                nativeError(
                    androidEnvelope(
                        undefined,
                        "[50166] Screen lock is missing."
                    )
                )
            ).kind
        ).toBe("no-screen-lock");
    });

    it("classifies [50157] excludeCredentials match as already-registered", () => {
        expect(
            classifyWebauthnError(
                nativeError(
                    androidEnvelope(
                        "androidx.credentials.TYPE_INVALID_STATE_ERROR",
                        "[50157] One of the excluded credentials exists on the local device."
                    )
                )
            ).kind
        ).toBe("already-registered");
    });

    it("classifies TYPE_NO_CREDENTIAL (no code) as no-credential", () => {
        expect(
            classifyWebauthnError(
                nativeError(
                    androidEnvelope(
                        "androidx.credentials.TYPE_NO_CREDENTIAL",
                        "No credentials available"
                    )
                )
            ).kind
        ).toBe("no-credential");
    });

    it("treats an unmapped GPS code as unknown, never cancelled", () => {
        const result = classifyWebauthnError(
            nativeError(
                androidEnvelope(ANDROID_NOT_ALLOWED, "[50128] transient")
            )
        );
        expect(result.kind).toBe("unknown");
        expect(result.retryable).toBe(true);
    });
});

describe("classifyWebauthnError — iOS + cancellation", () => {
    it("classifies a bare iOS cancellation as cancelled", () => {
        expect(classifyWebauthnError(nativeError("NotAllowedError")).kind).toBe(
            "cancelled"
        );
    });

    it("classifies iOS matchedExcludedCredential (1006) as already-registered", () => {
        expect(
            classifyWebauthnError(nativeError("InvalidStateError")).kind
        ).toBe("already-registered");
    });

    it("classifies the legacy iOS error-1001 message as cancelled", () => {
        expect(
            classifyWebauthnError(
                nativeError("The operation couldn't be completed. error 1001.")
            ).kind
        ).toBe("cancelled");
    });
});

describe("classifier-derived predicates", () => {
    it("isUserCancellation only matches cancellations", () => {
        expect(isUserCancellation(webError("NotAllowedError"))).toBe(true);
        expect(
            isUserCancellation(
                nativeError(
                    androidEnvelope(ANDROID_NOT_ALLOWED, "[50162] folsom")
                )
            )
        ).toBe(false);
    });

    it("isAuthenticatorAlreadyRegistered matches InvalidStateError", () => {
        expect(
            isAuthenticatorAlreadyRegistered(webError("InvalidStateError"))
        ).toBe(true);
        expect(
            isAuthenticatorAlreadyRegistered(webError("NotAllowedError"))
        ).toBe(false);
    });

    it("isReportableWebauthnError only flags developer-actionable kinds", () => {
        expect(isReportableWebauthnError(webError("UnknownError"))).toBe(true);
        expect(isReportableWebauthnError(webError("SecurityError"))).toBe(true);
        expect(isReportableWebauthnError(webError("NotSupportedError"))).toBe(
            true
        );
        expect(isReportableWebauthnError(webError("NotAllowedError"))).toBe(
            false
        );
        expect(
            isReportableWebauthnError(
                nativeError(
                    androidEnvelope(ANDROID_NOT_ALLOWED, "[50162] folsom")
                )
            )
        ).toBe(false);
    });
});

describe("webauthnErrorContext", () => {
    it("exposes the breadcrumb fields for analytics", () => {
        const context = webauthnErrorContext(
            nativeError(androidEnvelope(ANDROID_NOT_ALLOWED, "[50162] folsom"))
        );
        expect(context).toEqual({
            webauthn_error_kind: "sync-failed",
            webauthn_error_name: "NotAllowedError",
            gps_code: "50162",
            webauthn_retryable: true,
        });
    });
});

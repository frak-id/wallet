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

    it("classifies a CredMan-path folsom decrypt failure (no [50xxx] prefix, no 'folsom' word) as sync-failed", () => {
        // Android 14+ Credential Manager strips the [50162] prefix; the decrypt
        // message is the only locale-stable signal left and must NOT fall to
        // cancelled — this is the production blind spot the fix targets.
        const result = classifyWebauthnError(
            nativeError(
                androidEnvelope(
                    ANDROID_NOT_ALLOWED,
                    "Can't find the proper key to decrypt the private key from WebauthnCredentialSpecifics."
                )
            )
        );
        expect(result.kind).toBe("sync-failed");
        expect(result.retryable).toBe(true);
        expect(result.gpsCode).toBeUndefined();
    });

    it("classifies TYPE_NO_CREATE_OPTIONS (no eligible provider) as unsupported", () => {
        expect(
            classifyWebauthnError(
                nativeError(
                    androidEnvelope(
                        "android.credentials.CreateCredentialException.TYPE_NO_CREATE_OPTIONS",
                        "No create options available."
                    )
                )
            ).kind
        ).toBe("unsupported");
    });

    it("classifies TYPE_INTERRUPTED as a retryable cancel", () => {
        const result = classifyWebauthnError(
            nativeError(
                androidEnvelope(
                    "android.credentials.GetCredentialException.TYPE_INTERRUPTED",
                    "The operation was interrupted."
                )
            )
        );
        expect(result.kind).toBe("cancelled");
        expect(result.retryable).toBe(true);
    });

    it("reports a provider-configuration failure as unknown", () => {
        const err = nativeError(
            androidEnvelope(
                "androidx.credentials.TYPE_CREATE_CREDENTIAL_PROVIDER_CONFIGURATION_EXCEPTION",
                "Missing credentials-play-services-auth dependency."
            )
        );
        expect(classifyWebauthnError(err).kind).toBe("unknown");
        expect(isReportableWebauthnError(err)).toBe(true);
    });

    it("falls an unmapped GPS code through to the DOMException signal instead of forcing unknown", () => {
        // [50118] SECURITY_ERR is not in GPS_KIND; the fall-through keeps it
        // classified as security via the TYPE_SECURITY_ERROR token.
        expect(
            classifyWebauthnError(
                nativeError(
                    androidEnvelope(
                        "androidx.credentials.TYPE_SECURITY_ERROR",
                        "[50118] Security policy violation."
                    )
                )
            ).kind
        ).toBe("security");
    });

    it("treats an unmapped NOT_ALLOWED GPS code as a soft cancel, not a reported bug", () => {
        // [50164] biometric error — environmental/transient, not developer-actionable.
        const err = nativeError(
            androidEnvelope(ANDROID_NOT_ALLOWED, "[50164] biometric error")
        );
        expect(classifyWebauthnError(err).kind).toBe("cancelled");
        expect(isReportableWebauthnError(err)).toBe(false);
    });
});

describe("classifyWebauthnError — iOS envelope", () => {
    // The iOS plugin maps the ASAuthorizationError code → a DOMException-name
    // `type` and surfaces the numeric code in the message as `[100x]`.
    const iosError = (type: string, code: number) =>
        nativeError(JSON.stringify({ type, message: `[${code}] failure` }));

    it("classifies .canceled (1001 → NotAllowedError) as cancelled", () => {
        expect(
            classifyWebauthnError(iosError("NotAllowedError", 1001)).kind
        ).toBe("cancelled");
    });

    it("classifies .matchedExcludedCredential (1006 → InvalidStateError) as already-registered", () => {
        expect(
            classifyWebauthnError(iosError("InvalidStateError", 1006)).kind
        ).toBe("already-registered");
    });

    it("classifies .failed (1004 → UnknownError) as a reported unknown, code stays out of gpsCode", () => {
        const err = iosError("UnknownError", 1004);
        const result = classifyWebauthnError(err);
        expect(result.kind).toBe("unknown");
        // 4-digit iOS code must never match the [5xxxx] GPS-code regex.
        expect(result.gpsCode).toBeUndefined();
        expect(isReportableWebauthnError(err)).toBe(true);
    });

    it("classifies a bare-string fatal precondition reject as unknown", () => {
        // Early native guards (missing options, no window) keep rejecting bare
        // strings — the JS bridge treats those as opaque.
        expect(
            classifyWebauthnError(
                nativeError("No active foreground window for WebAuthn")
            ).kind
        ).toBe("unknown");
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

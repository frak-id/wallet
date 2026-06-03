import { describe, expect, it } from "vitest";
import { parseNativeWebauthnError } from "./errors";
import { resolveWebauthnErrorView } from "./errorView";

function ox(name: string, cause: Error): Error {
    const err = new Error("Failed.");
    err.name = name;
    err.cause = cause;
    return err;
}

function dom(name: string): Error {
    const err = new Error(`${name} occurred`);
    err.name = name;
    return err;
}

function native(raw: string): Error {
    const { name, gpsCode, message } = parseNativeWebauthnError(raw);
    const err = new Error(message) as Error & { gpsCode?: string };
    if (name) err.name = name;
    if (gpsCode) err.gpsCode = gpsCode;
    return ox("Registration.CreateFailedError", err);
}

const folsom = () =>
    native(
        JSON.stringify({
            type: "androidx.credentials.TYPE_NOT_ALLOWED_ERROR",
            message: "[50162] folsom",
        })
    );

describe("resolveWebauthnErrorView", () => {
    it("maps cancellation to the warning notAllowed view with a retry action", () => {
        const view = resolveWebauthnErrorView(
            ox("SignFailedError", dom("NotAllowedError"))
        );
        expect(view.tone).toBe("warning");
        expect(view.baseKey).toBe("error.webauthn.notAllowed");
        expect(view.actionKey).toBe("error.webauthn.retry");
        expect(view.retryable).toBe(true);
    });

    it("maps AbortError to the cancellation view", () => {
        expect(resolveWebauthnErrorView(dom("AbortError")).baseKey).toBe(
            "error.webauthn.notAllowed"
        );
    });

    it("maps folsom/sync-failed to the warning view with guidance steps", () => {
        const view = resolveWebauthnErrorView(folsom());
        expect(view.tone).toBe("warning");
        expect(view.baseKey).toBe("error.webauthn.syncFailed");
        expect(view.stepKeys).toHaveLength(3);
        expect(view.retryable).toBe(true);
    });

    it("maps a CredMan folsom with no [50xxx] prefix to sync-failed", () => {
        const view = resolveWebauthnErrorView(
            native(
                JSON.stringify({
                    type: "androidx.credentials.TYPE_NOT_ALLOWED_ERROR",
                    message:
                        "Can't find the proper key to decrypt the private key from WebauthnCredentialSpecifics.",
                })
            )
        );
        expect(view.baseKey).toBe("error.webauthn.syncFailed");
    });

    it("maps ConstraintError to the no-screen-lock view", () => {
        const view = resolveWebauthnErrorView(dom("ConstraintError"));
        expect(view.tone).toBe("warning");
        expect(view.baseKey).toBe("error.webauthn.noScreenLock");
    });

    it("maps NotSupportedError to the danger unsupported view with no action", () => {
        const view = resolveWebauthnErrorView(dom("NotSupportedError"));
        expect(view.tone).toBe("danger");
        expect(view.baseKey).toBe("error.webauthn.unsupported");
        expect(view.actionKey).toBeUndefined();
        expect(view.retryable).toBe(false);
    });

    it("offers a 'log in' action for already-registered, only in an auth context", () => {
        const authView = resolveWebauthnErrorView(
            dom("InvalidStateError"),
            "register"
        );
        expect(authView.baseKey).toBe("error.webauthn.alreadyRegistered");
        expect(authView.tone).toBe("neutral");
        expect(authView.actionKey).toBe("error.webauthn.login");
        expect(
            resolveWebauthnErrorView(dom("InvalidStateError"), "sign").baseKey
        ).toBe("error.webauthn.generic");
    });

    it("routes no-credential to a warning view with no action", () => {
        const view = resolveWebauthnErrorView(
            native(
                JSON.stringify({
                    type: "androidx.credentials.TYPE_NO_CREDENTIAL",
                    message: "No credentials available",
                })
            ),
            "login"
        );
        expect(view.tone).toBe("warning");
        expect(view.baseKey).toBe("error.webauthn.noCredential");
        expect(view.actionKey).toBeUndefined();
    });

    it("maps the transaction-execution error to its own view", () => {
        const error = new Error("Execution failed");
        error.name = "UserOperationExecutionError";
        const view = resolveWebauthnErrorView(error);
        expect(view.baseKey).toBe("error.webauthn.userOperationExecution");
        expect(view.retryable).toBe(false);
    });

    it("falls back to the generic danger view for unknown errors", () => {
        const view = resolveWebauthnErrorView(new Error("boom"));
        expect(view.tone).toBe("danger");
        expect(view.baseKey).toBe("error.webauthn.generic");
    });
});

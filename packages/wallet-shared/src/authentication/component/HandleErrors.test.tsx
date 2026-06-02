import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseNativeWebauthnError } from "../webauthn/errors";
import { HandleErrors } from "./HandleErrors";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                "error.webauthn.notAllowed": "Authentication was cancelled",
                "error.webauthn.userOperationExecution":
                    "Transaction execution failed",
                "error.webauthn.generic": "An error occurred",
                "error.webauthn.retry": "Try again",
                "error.webauthn.alreadyRegistered": "Already registered",
                "error.webauthn.noCredential": "No passkey on device",
                "error.webauthn.noScreenLock": "Set up a screen lock",
                "error.webauthn.unsupported": "Passkeys unsupported",
                "error.webauthn.passkeyManager.intro": "Passkey manager issue",
                "error.webauthn.passkeyManager.action1": "Action one",
                "error.webauthn.passkeyManager.action2": "Action two",
                "error.webauthn.passkeyManager.action3": "Action three",
            };
            return translations[key] || key;
        },
    }),
}));

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

describe("HandleErrors", () => {
    it("renders cancellation copy for NotAllowedError", () => {
        render(
            <HandleErrors
                error={ox("SignFailedError", dom("NotAllowedError"))}
            />
        );
        expect(
            screen.getByText("Authentication was cancelled")
        ).toBeInTheDocument();
    });

    it("renders cancellation copy for AbortError", () => {
        render(<HandleErrors error={dom("AbortError")} />);
        expect(
            screen.getByText("Authentication was cancelled")
        ).toBeInTheDocument();
    });

    it("renders actionable passkey-manager guidance for folsom/sync-failed", () => {
        render(<HandleErrors error={folsom()} />);
        expect(screen.getByText("Passkey manager issue")).toBeInTheDocument();
        expect(screen.getByText("Action one")).toBeInTheDocument();
    });

    it("renders passkey-manager guidance for a CredMan folsom with no [50xxx] prefix", () => {
        const err = native(
            JSON.stringify({
                type: "androidx.credentials.TYPE_NOT_ALLOWED_ERROR",
                message:
                    "Can't find the proper key to decrypt the private key from WebauthnCredentialSpecifics.",
            })
        );
        render(<HandleErrors error={err} />);
        expect(screen.getByText("Passkey manager issue")).toBeInTheDocument();
    });

    it("renders no-screen-lock copy for ConstraintError", () => {
        render(<HandleErrors error={dom("ConstraintError")} />);
        expect(screen.getByText("Set up a screen lock")).toBeInTheDocument();
    });

    it("renders unsupported copy for NotSupportedError", () => {
        render(<HandleErrors error={dom("NotSupportedError")} />);
        expect(screen.getByText("Passkeys unsupported")).toBeInTheDocument();
    });

    it("routes already-registered copy only in an auth context", () => {
        const { rerender } = render(
            <HandleErrors
                error={dom("InvalidStateError")}
                operation="register"
            />
        );
        expect(screen.getByText("Already registered")).toBeInTheDocument();

        rerender(
            <HandleErrors error={dom("InvalidStateError")} operation="sign" />
        );
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
    });

    it("routes no-credential copy only in an auth context", () => {
        render(
            <HandleErrors
                error={native(
                    JSON.stringify({
                        type: "androidx.credentials.TYPE_NO_CREDENTIAL",
                        message: "No credentials available",
                    })
                )}
                operation="login"
            />
        );
        expect(screen.getByText("No passkey on device")).toBeInTheDocument();
    });

    it("renders the transaction-execution error branch", () => {
        const error = new Error("Execution failed");
        error.name = "UserOperationExecutionError";
        render(<HandleErrors error={error} />);
        expect(
            screen.getByText("Transaction execution failed")
        ).toBeInTheDocument();
    });

    it("renders generic copy for an unknown error", () => {
        render(<HandleErrors error={new Error("boom")} />);
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
    });

    it("keeps the error text in a p.error element", () => {
        const { container } = render(
            <HandleErrors error={new Error("boom")} />
        );
        expect(container.querySelector("p.error")).toBeInTheDocument();
    });

    describe("retry affordance", () => {
        it("renders a Try again button for retryable kinds when onRetry is set", () => {
            const onRetry = vi.fn();
            render(
                <HandleErrors
                    error={dom("NotAllowedError")}
                    onRetry={onRetry}
                />
            );
            const button = screen.getByRole("button", { name: "Try again" });
            fireEvent.click(button);
            expect(onRetry).toHaveBeenCalledOnce();
        });

        it("offers retry alongside the folsom guidance", () => {
            const onRetry = vi.fn();
            render(<HandleErrors error={folsom()} onRetry={onRetry} />);
            expect(
                screen.getByRole("button", { name: "Try again" })
            ).toBeInTheDocument();
        });

        it("does not render retry for non-retryable kinds", () => {
            render(
                <HandleErrors
                    error={dom("InvalidStateError")}
                    operation="register"
                    onRetry={vi.fn()}
                />
            );
            expect(
                screen.queryByRole("button", { name: "Try again" })
            ).not.toBeInTheDocument();
        });

        it("does not render retry when onRetry is omitted", () => {
            render(<HandleErrors error={dom("NotAllowedError")} />);
            expect(
                screen.queryByRole("button", { name: "Try again" })
            ).not.toBeInTheDocument();
        });
    });
});

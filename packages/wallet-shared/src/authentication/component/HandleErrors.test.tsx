import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HandleErrors } from "./HandleErrors";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                "error.webauthn.notAllowed": "Authentication was cancelled",
                "error.webauthn.userOperationExecution":
                    "Transaction execution failed",
                "error.webauthn.generic": "An error occurred",
            };
            return translations[key] || key;
        },
    }),
}));

function oxWrapped(name: string, cause: Error): Error {
    const err = new Error(
        `Failed to create credential.\n\nDetails: ${cause.message}`
    );
    err.name = name;
    err.cause = cause;
    return err;
}

function tauriWrapped(nativeMessage: string): Error {
    const native = new Error(nativeMessage);
    const bridge = new Error("Tauri create credential error");
    bridge.cause = native;
    const ox = new Error("Failed to create credential.");
    ox.name = "Registration.CreateFailedError";
    ox.cause = bridge;
    return ox;
}

describe("HandleErrors", () => {
    describe("direct cancellation (raw DOMException)", () => {
        it("should detect NotAllowedError", () => {
            const error = new Error("The operation was not allowed.");
            error.name = "NotAllowedError";

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should detect AbortError (Firefox)", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });
    });

    describe("Ox-wrapped cancellation (web browser)", () => {
        it("should detect NotAllowedError wrapped by CreateFailedError", () => {
            const dom = new Error("The operation was not allowed.");
            dom.name = "NotAllowedError";
            const error = oxWrapped("Registration.CreateFailedError", dom);

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should detect NotAllowedError wrapped by SignFailedError", () => {
            const dom = new Error("The operation was not allowed.");
            dom.name = "NotAllowedError";
            const error = oxWrapped("Authentication.SignFailedError", dom);

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should detect AbortError wrapped by SignFailedError (Firefox)", () => {
            const dom = new Error("Aborted");
            dom.name = "AbortError";
            const error = oxWrapped("Authentication.SignFailedError", dom);

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });
    });

    describe("Tauri-wrapped cancellation (iOS/Android)", () => {
        it("should detect iOS cancellation (The operation was canceled.)", () => {
            const error = tauriWrapped("The operation was canceled.");

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should detect Android cancellation (user cancelled)", () => {
            const error = tauriWrapped(
                "User cancelled the credential manager selector"
            );

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should detect iOS ASAuthorizationError.canceled (error 1001)", () => {
            const error = tauriWrapped(
                "The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)"
            );

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });
    });

    describe("UserOperationExecutionError", () => {
        it("should render userOperationExecution error", () => {
            const error = new Error("Execution failed");
            error.name = "UserOperationExecutionError";

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Transaction execution failed")
            ).toBeInTheDocument();
        });
    });

    describe("GenericError", () => {
        it("should render generic error for unknown error types", () => {
            const error = new Error("Something went wrong");

            render(<HandleErrors error={error} />);

            expect(screen.getByText("An error occurred")).toBeInTheDocument();
        });

        it("should render generic error for TypeError", () => {
            const error = new TypeError("Type mismatch");

            render(<HandleErrors error={error} />);

            expect(screen.getByText("An error occurred")).toBeInTheDocument();
        });

        it("should render generic error for RangeError", () => {
            const error = new RangeError("Out of range");

            render(<HandleErrors error={error} />);

            expect(screen.getByText("An error occurred")).toBeInTheDocument();
        });
    });

    describe("error wrapper styling", () => {
        it("should render error in paragraph with error class", () => {
            const error = new Error("Test error");

            const { container } = render(<HandleErrors error={error} />);

            const errorElement = container.querySelector("p.error");
            expect(errorElement).toBeInTheDocument();
        });
    });
});

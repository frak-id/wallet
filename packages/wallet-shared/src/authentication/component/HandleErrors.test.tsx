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

describe("HandleErrors", () => {
    describe("NotAllowedError", () => {
        it("should render notAllowed error for NotAllowedError", () => {
            const error = new Error("User cancelled");
            error.name = "NotAllowedError";

            render(<HandleErrors error={error} />);

            expect(
                screen.getByText("Authentication was cancelled")
            ).toBeInTheDocument();
        });

        it("should render notAllowed error for AbortError (Firefox)", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";

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

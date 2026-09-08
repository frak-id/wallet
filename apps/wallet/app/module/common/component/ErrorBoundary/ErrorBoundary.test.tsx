import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./index";

const { recordErrorMock } = vi.hoisted(() => ({
    recordErrorMock: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    recordError: recordErrorMock,
}));

function Boom(): never {
    throw new Error("boom");
}

describe("ErrorBoundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("renders children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <p>healthy</p>
            </ErrorBoundary>
        );

        expect(screen.getByText("healthy")).toBeInTheDocument();
        expect(recordErrorMock).not.toHaveBeenCalled();
    });

    it("replaces the thrown subtree with the fallback", () => {
        render(
            <ErrorBoundary>
                <p>healthy</p>
                <Boom />
            </ErrorBoundary>
        );

        expect(screen.queryByText("healthy")).not.toBeInTheDocument();
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("reports the caught error once under the boundary source", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );

        expect(recordErrorMock).toHaveBeenCalledTimes(1);
        expect(recordErrorMock).toHaveBeenCalledWith(expect.any(Error), {
            source: "error_boundary",
        });
    });

    it("moves focus to the recovery action so the keyboard user is not stranded", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );

        expect(screen.getByRole("button", { name: /reload/i })).toHaveFocus();
    });

    it("offers reloading rather than promising a retry it does not perform", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );

        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(/reload/i);
        expect(alert).not.toHaveTextContent(/try again/i);
    });

    it("claims nothing about what happened to work in progress", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );

        expect(screen.getByRole("alert")).not.toHaveTextContent(
            /saved|lost|completed|progress|unsaved/i
        );
    });

    it("reloads the page rather than clearing boundary state", () => {
        const reload = vi.fn();
        Object.defineProperty(window, "location", {
            value: { reload },
            writable: true,
        });

        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );
        screen.getByRole("button", { name: /reload/i }).click();

        expect(reload).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });
});

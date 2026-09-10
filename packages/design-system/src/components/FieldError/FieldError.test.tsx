import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError } from "./index";

describe("FieldError", () => {
    it("should render nothing when it has no message", () => {
        const { container } = render(<FieldError />);
        expect(container).toBeEmptyDOMElement();
    });

    it("should render the message when given children", () => {
        render(<FieldError>Required field</FieldError>);
        expect(screen.getByText("Required field")).toBeInTheDocument();
    });

    it("should render the exclamation icon alongside the message", () => {
        const { container } = render(<FieldError>Bad input</FieldError>);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("should forward the id so callers can wire aria-describedby", () => {
        render(<FieldError id="email-error">Invalid email</FieldError>);
        expect(
            screen.getByText("Invalid email").closest("#email-error")
        ).not.toBeNull();
    });

    it("announces politely, including when the message changes in place", () => {
        const { rerender } = render(<FieldError />);
        expect(screen.queryByRole("status")).toBeNull();

        rerender(<FieldError>Pool is 10 EUR</FieldError>);
        const region = screen.getByRole("status");
        expect(region).toHaveTextContent("Pool is 10 EUR");

        // Same node, new text: a non-live element would swallow this.
        rerender(<FieldError>Pool is 105 EUR</FieldError>);
        expect(screen.getByRole("status")).toBe(region);
        expect(region).toHaveTextContent("Pool is 105 EUR");
    });

    it("can interrupt when a caller opts into the assertive role", () => {
        render(<FieldError role="alert">Invalid email</FieldError>);
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
    });
});

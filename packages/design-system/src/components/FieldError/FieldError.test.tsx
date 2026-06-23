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
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError, FieldLabel } from "./index";

describe("Field", () => {
    describe("FieldLabel", () => {
        it("renders the children", () => {
            render(<FieldLabel>Recipient</FieldLabel>);
            expect(screen.getByText("Recipient")).toBeInTheDocument();
        });
    });

    describe("FieldError", () => {
        it("renders the children", () => {
            render(<FieldError>Required</FieldError>);
            expect(screen.getByText("Required")).toBeInTheDocument();
        });
    });
});

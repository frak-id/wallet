import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldError, FieldLabel } from "./index";

describe("Field", () => {
    describe("FieldLabel", () => {
        it("renders the children", () => {
            render(<FieldLabel>Recipient</FieldLabel>);
            expect(screen.getByText("Recipient")).toBeInTheDocument();
        });

        it("applies the bare-input 16px horizontal indent on the wrapper", () => {
            const { container } = render(<FieldLabel>Recipient</FieldLabel>);
            // The wrapper Box uses the sprinkles `paddingX="m"` which maps
            // to a class containing the spacing-m token. The class set is
            // hashed by vanilla-extract, so we assert presence of any class
            // hinting at the m-scale padding instead of an exact name.
            const wrapper = container.firstElementChild as HTMLElement;
            expect(wrapper.className).toMatch(/paddingRight_m|paddingLeft_m/);
        });
    });

    describe("FieldError", () => {
        it("renders the children", () => {
            render(<FieldError>Required</FieldError>);
            expect(screen.getByText("Required")).toBeInTheDocument();
        });

        it("renders inside a wrapper with the same 16px indent as FieldLabel", () => {
            const { container } = render(<FieldError>Required</FieldError>);
            const wrapper = container.firstElementChild as HTMLElement;
            expect(wrapper.className).toMatch(/paddingRight_m|paddingLeft_m/);
        });
    });
});

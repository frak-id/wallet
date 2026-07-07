/// <reference types="@testing-library/jest-dom" />
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldLabel } from "./index";

describe("FieldLabel", () => {
    it("associates the label with the control via htmlFor↔id", () => {
        render(
            <FieldLabel label="Country" htmlFor="country-select">
                <button type="button" id="country-select">
                    Pick
                </button>
            </FieldLabel>
        );
        const label = screen.getByText("Country");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", "country-select");
        // The control is programmatically labelled by the label element.
        expect(
            screen.getByRole("button", { name: "Country" })
        ).toBeInTheDocument();
    });

    it("renders the hint with a derived id so the control can describe itself", () => {
        render(
            <FieldLabel
                label="Country"
                hint="Where you operate"
                htmlFor="country-select"
            >
                <button
                    type="button"
                    id="country-select"
                    aria-describedby="country-select-hint"
                >
                    Pick
                </button>
            </FieldLabel>
        );
        const hint = screen.getByText("Where you operate");
        expect(hint).toHaveAttribute("id", "country-select-hint");
        expect(
            screen.getByRole("button", { name: "Country" })
        ).toHaveAccessibleDescription("Where you operate");
    });

    it("renders only the control when no label/hint is given", () => {
        const { container } = render(
            <FieldLabel>
                <input id="x" />
            </FieldLabel>
        );
        expect(container.querySelector("label")).toBeNull();
        expect(container.querySelector("span")).toBeNull();
        expect(container.querySelector("input")).not.toBeNull();
    });

    it("nests control+hint under the label (8/4 spacing structure)", () => {
        const { container } = render(
            <FieldLabel label="L" hint="H" htmlFor="x">
                <input id="x" aria-describedby="x-hint" />
            </FieldLabel>
        );
        const label = container.querySelector("label");
        const input = container.querySelector("input");
        const hint = screen.getByText("H");
        const outer = label?.parentElement;
        const inner = hint.parentElement;
        expect(outer).not.toBe(inner);
        expect(outer).toContainElement(inner);
        expect(inner).toContainElement(input);
    });

    it("reserves label height (bottom-anchored) when reserveLabelLines is set", () => {
        render(
            <FieldLabel label="Long label" htmlFor="x" reserveLabelLines={2}>
                <input id="x" />
            </FieldLabel>
        );
        const label = screen.getByText("Long label");
        // 2 lines × 22px line-height.
        expect(label).toHaveStyle({ minHeight: "44px" });
    });

    it("omits the label element but keeps the hint when only hint is given", () => {
        const { container } = render(
            <FieldLabel hint="H" htmlFor="x">
                <input id="x" aria-describedby="x-hint" />
            </FieldLabel>
        );
        expect(container.querySelector("label")).toBeNull();
        expect(within(container).getByText("H")).toHaveAttribute(
            "id",
            "x-hint"
        );
    });
});

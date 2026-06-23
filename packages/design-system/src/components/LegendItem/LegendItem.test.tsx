/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegendItem } from "./index";
import { legendItem } from "./legendItem.css";

describe("LegendItem", () => {
    it("renders the label and a coloured swatch", () => {
        const { container } = render(
            <LegendItem swatchColor="rgb(0, 67, 239)">Actual</LegendItem>
        );
        expect(screen.getByText("Actual")).toBeInTheDocument();
        const swatch = container.querySelector('[aria-hidden="true"]');
        expect(swatch).toHaveStyle({ backgroundColor: "rgb(0, 67, 239)" });
    });

    it("defaults to the inline layout and supports stacked", () => {
        const { container, rerender } = render(
            <LegendItem swatchColor="#000">A</LegendItem>
        );
        expect(container.firstChild).toHaveClass(legendItem.inline);

        rerender(
            <LegendItem swatchColor="#000" layout="stacked">
                A
            </LegendItem>
        );
        expect(container.firstChild).toHaveClass(legendItem.stacked);
    });

    it("forwards div props and className", () => {
        const { container } = render(
            <LegendItem swatchColor="#000" className="extra" data-test="x">
                A
            </LegendItem>
        );
        expect(container.firstChild).toHaveClass("extra");
        expect(container.firstChild).toHaveAttribute("data-test", "x");
    });
});

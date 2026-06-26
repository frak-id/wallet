/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tiles } from "./index";
import { tilesGrid } from "./index.css";

describe("Tiles", () => {
    it("renders children in a div by default", () => {
        render(
            <Tiles>
                <span>A</span>
                <span>B</span>
            </Tiles>
        );
        expect(screen.getByText("A").parentElement?.tagName).toBe("DIV");
    });

    it("applies the tilesGrid class (carries grid-template-columns CSS vars)", () => {
        render(
            <Tiles>
                <span>item</span>
            </Tiles>
        );
        const el = screen.getByText("item").parentElement;
        expect(el?.className.split(" ")).toContain(tilesGrid);
    });

    it("applies different gap class for different space values", () => {
        const { rerender } = render(
            <Tiles space="m">
                <span>a</span>
            </Tiles>
        );
        const withGap = screen.getByText("a").parentElement?.className ?? "";

        rerender(
            <Tiles space="none">
                <span>a</span>
            </Tiles>
        );
        const noGap = screen.getByText("a").parentElement?.className ?? "";

        // Different gap tokens → different sprinkle classes
        expect(withGap).not.toBe(noGap);
    });

    it("sets CSS vars for a scalar columns value (all breakpoints equal)", () => {
        render(
            <Tiles columns={3}>
                <span>x</span>
            </Tiles>
        );
        const el = screen.getByText("x").parentElement as HTMLElement;
        const style = el.getAttribute("style") ?? "";
        expect(style).toContain("--tiles-cols-mobile: 3");
        expect(style).toContain("--tiles-cols-tablet: 3");
        expect(style).toContain("--tiles-cols-desktop: 3");
    });

    it("sets CSS vars for a responsive columns object", () => {
        render(
            <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
                <span>y</span>
            </Tiles>
        );
        const el = screen.getByText("y").parentElement as HTMLElement;
        const style = el.getAttribute("style") ?? "";
        expect(style).toContain("--tiles-cols-mobile: 1");
        expect(style).toContain("--tiles-cols-tablet: 2");
        expect(style).toContain("--tiles-cols-desktop: 3");
    });

    it("carries forward mobile value when tablet/desktop are omitted", () => {
        render(
            <Tiles columns={{ mobile: 2 }}>
                <span>z</span>
            </Tiles>
        );
        const el = screen.getByText("z").parentElement as HTMLElement;
        const style = el.getAttribute("style") ?? "";
        expect(style).toContain("--tiles-cols-mobile: 2");
        expect(style).toContain("--tiles-cols-tablet: 2");
        expect(style).toContain("--tiles-cols-desktop: 2");
    });

    it("renders with a custom element via as prop", () => {
        render(
            <Tiles as="ul">
                <li>list item</li>
            </Tiles>
        );
        expect(screen.getByText("list item").parentElement?.tagName).toBe("UL");
    });

    it("forwards className after tilesGrid class", () => {
        render(
            <Tiles className="custom-override">
                <span>w</span>
            </Tiles>
        );
        const el = screen.getByText("w").parentElement;
        const classes = el?.className.split(" ") ?? [];
        expect(classes).toContain(tilesGrid);
        expect(classes).toContain("custom-override");
    });
});

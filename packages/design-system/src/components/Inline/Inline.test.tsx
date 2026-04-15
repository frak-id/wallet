/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Inline } from "./index";

describe("Inline", () => {
    it("should render children in a div by default", () => {
        render(
            <Inline space="s">
                <span>X</span>
                <span>Y</span>
            </Inline>
        );
        const x = screen.getByText("X");
        expect(x.parentElement?.tagName).toBe("DIV");
    });

    it("should apply sprinkle classes for flex wrap", () => {
        render(
            <Inline space="s">
                <span>item</span>
            </Inline>
        );
        const el = screen.getByText("item").parentElement;
        expect(el?.className).toBeTruthy();
    });

    it("should change rendered element when as prop provided", () => {
        render(
            <Inline space="s" as="nav">
                <span>nav item</span>
            </Inline>
        );
        expect(screen.getByText("nav item").parentElement?.tagName).toBe("NAV");
    });

    it("should apply different classes for different alignment combinations", () => {
        const { rerender } = render(
            <Inline space="s" align="center" alignY="center">
                <span>test</span>
            </Inline>
        );
        const centeredClass =
            screen.getByText("test").parentElement?.className ?? "";

        rerender(
            <Inline space="s">
                <span>test</span>
            </Inline>
        );
        const defaultClass =
            screen.getByText("test").parentElement?.className ?? "";

        expect(centeredClass).not.toBe(defaultClass);
    });
});

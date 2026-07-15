/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spread } from "./index";

describe("Spread", () => {
    it("renders children in a div by default", () => {
        render(
            <Spread>
                <span>a</span>
                <span>b</span>
            </Spread>
        );
        expect(screen.getByText("a")).toBeTruthy();
        expect(screen.getByText("a").parentElement?.tagName).toBe("DIV");
    });

    it("applies the base spread class", () => {
        render(
            <Spread>
                <span>content</span>
            </Spread>
        );
        expect(
            screen.getByText("content").parentElement?.className
        ).toBeTruthy();
    });

    it("changes flex-direction class between horizontal and vertical", () => {
        const { rerender } = render(
            <Spread direction="horizontal">
                <span>test</span>
            </Spread>
        );
        const horizontal =
            screen.getByText("test").parentElement?.className ?? "";

        rerender(
            <Spread direction="vertical">
                <span>test</span>
            </Spread>
        );
        const vertical =
            screen.getByText("test").parentElement?.className ?? "";

        expect(horizontal).not.toBe(vertical);
    });

    it("changes alignItems class per align prop", () => {
        const { rerender } = render(
            <Spread align="center">
                <span>test</span>
            </Spread>
        );
        const center = screen.getByText("test").parentElement?.className ?? "";

        rerender(
            <Spread align="top">
                <span>test</span>
            </Spread>
        );
        const top = screen.getByText("test").parentElement?.className ?? "";

        expect(center).not.toBe(top);
    });

    it("forwards className alongside the base styles", () => {
        render(
            <Spread className="extra">
                <span>classed</span>
            </Spread>
        );
        expect(screen.getByText("classed").parentElement?.className).toContain(
            "extra"
        );
    });

    it("renders the given element tag via as prop", () => {
        render(
            <Spread as="header">
                <span>headed</span>
            </Spread>
        );
        expect(screen.getByText("headed").parentElement?.tagName).toBe(
            "HEADER"
        );
    });
});

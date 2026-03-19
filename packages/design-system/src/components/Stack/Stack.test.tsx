/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stack } from "./index";

describe("Stack", () => {
    it("should render children in a div by default", () => {
        render(
            <Stack space="m">
                <span>A</span>
                <span>B</span>
            </Stack>
        );
        const a = screen.getByText("A");
        expect(a.parentElement?.tagName).toBe("DIV");
    });

    it("should apply sprinkle classes for flex column and gap", () => {
        render(
            <Stack space="m">
                <span>content</span>
            </Stack>
        );
        const el = screen.getByText("content").parentElement;
        expect(el?.className).toBeTruthy();
    });

    it("should change rendered element when as prop provided", () => {
        render(
            <Stack space="s" as="ul">
                <li>item</li>
            </Stack>
        );
        expect(screen.getByText("item").parentElement?.tagName).toBe("UL");
    });

    it("should set alignItems class when align prop provided", () => {
        const { rerender } = render(
            <Stack space="s" align="center">
                <span>test</span>
            </Stack>
        );
        const centered =
            screen.getByText("test").parentElement?.className ?? "";

        rerender(
            <Stack space="s" align="left">
                <span>test</span>
            </Stack>
        );
        const left = screen.getByText("test").parentElement?.className ?? "";

        // Different alignment = different class
        expect(centered).not.toBe(left);
    });
});

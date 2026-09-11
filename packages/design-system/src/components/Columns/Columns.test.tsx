/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Column } from "../Column";
import { Columns } from "./index";

describe("Columns", () => {
    it("should render children in a flex row container", () => {
        render(
            <Columns space="m">
                <Column>
                    <span>left</span>
                </Column>
                <Column>
                    <span>right</span>
                </Column>
            </Columns>
        );
        const left = screen.getByText("left");
        expect(left.closest("div")).toBeInTheDocument();
    });

    it("should render Column with content width (natural width via flexShrink)", () => {
        render(
            <Columns space="s">
                <Column width="content">
                    <span>sidebar</span>
                </Column>
                <Column>
                    <span>main</span>
                </Column>
            </Columns>
        );
        expect(screen.getByText("sidebar")).toBeInTheDocument();
        expect(screen.getByText("main")).toBeInTheDocument();
    });

    it("should render Column with fractional width via style", () => {
        render(
            <Columns space="s">
                <Column width="1/2">
                    <span>half</span>
                </Column>
                <Column>
                    <span>rest</span>
                </Column>
            </Columns>
        );
        const half = screen.getByText("half");
        // Column with width="1/2" grows as one gap-aware share (basis 0)
        expect(half.parentElement?.style.flex).toBe("1 1 0%");
    });
});

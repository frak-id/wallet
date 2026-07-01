/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./index";

describe("Notice", () => {
    it("should render its children", () => {
        render(<Notice>Heads up</Notice>);
        expect(screen.getByText("Heads up")).toBeInTheDocument();
    });

    it("should apply a different class for different tones", () => {
        const { container, rerender } = render(
            <Notice tone="info">msg</Notice>
        );
        const info = container.firstElementChild?.className ?? "";

        rerender(<Notice tone="warning">msg</Notice>);
        const warning = container.firstElementChild?.className ?? "";

        expect(info).not.toBe(warning);
    });

    it("should apply a different class for different display modes", () => {
        const { container, rerender } = render(
            <Notice display="block">msg</Notice>
        );
        const block = container.firstElementChild?.className ?? "";

        rerender(<Notice display="inline">msg</Notice>);
        const inline = container.firstElementChild?.className ?? "";

        expect(block).not.toBe(inline);
    });

    it("should render a default icon for the given tone", () => {
        const { container } = render(<Notice tone="error">msg</Notice>);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("should mark the decorative icon aria-hidden", () => {
        const { container } = render(<Notice tone="error">msg</Notice>);
        expect(
            container.querySelector("svg")?.closest("[aria-hidden]")
        ).not.toBeNull();
    });

    it("should suppress the icon when icon is explicitly null", () => {
        const { container } = render(<Notice icon={null}>no icon here</Notice>);
        expect(container.querySelector("svg")).not.toBeInTheDocument();
    });

    it("should render a custom icon when provided", () => {
        render(<Notice icon={<span data-testid="custom-icon" />}>msg</Notice>);
        expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });

    it("should forward className to the root", () => {
        const { container } = render(
            <Notice className="extra-class">msg</Notice>
        );
        expect(container.firstElementChild?.className).toContain("extra-class");
    });

    it("should forward id so callers can wire aria-describedby", () => {
        render(<Notice id="notice-id">msg</Notice>);
        expect(screen.getByText("msg").closest("#notice-id")).not.toBeNull();
    });

    it("should forward role to the root", () => {
        render(<Notice role="alert">boom</Notice>);
        expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });
});

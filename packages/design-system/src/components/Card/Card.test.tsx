import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./index";

describe("Card", () => {
    it("should render as div with children", () => {
        render(<Card>card content</Card>);
        const el = screen.getByText("card content");
        expect(el).toBeInTheDocument();
        expect(el.tagName).toBe("DIV");
    });

    it("should have className with padding=compact different from padding=none", () => {
        const { rerender } = render(<Card padding="compact">test</Card>);
        const compactClass = screen.getByText("test").className;

        rerender(<Card padding="none">test</Card>);
        const noneClass = screen.getByText("test").className;

        expect(compactClass).not.toBe(noneClass);
    });

    it("should have different className for elevated vs muted variant", () => {
        const { rerender } = render(<Card variant="elevated">test</Card>);
        const elevatedClass = screen.getByText("test").className;

        rerender(<Card variant="muted">test</Card>);
        const mutedClass = screen.getByText("test").className;

        expect(elevatedClass).not.toBe(mutedClass);
    });

    it("should render children correctly", () => {
        render(
            <Card>
                <span>child 1</span>
                <span>child 2</span>
            </Card>
        );
        expect(screen.getByText("child 1")).toBeInTheDocument();
        expect(screen.getByText("child 2")).toBeInTheDocument();
    });
});

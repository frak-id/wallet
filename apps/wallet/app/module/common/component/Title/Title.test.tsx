import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Title } from "./index";

describe("Title", () => {
    it("should render with text content", () => {
        render(<Title>Test Title</Title>);

        expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("should render with ReactNode children", () => {
        render(
            <Title>
                <span data-testid="custom-title">Custom Title</span>
            </Title>
        );

        expect(screen.getByTestId("custom-title")).toBeInTheDocument();
    });

    it("should render with icon", () => {
        render(
            <Title icon={<span data-testid="icon">Icon</span>}>
                Title with icon
            </Title>
        );

        expect(screen.getByTestId("icon")).toBeInTheDocument();
        expect(screen.getByText("Title with icon")).toBeInTheDocument();
    });

    it("should render a h1 for the page size", () => {
        const { container } = render(<Title size="page">Title</Title>);

        expect(container.querySelector("h1")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Title className="custom-title">Title</Title>
        );

        const title = container.querySelector("h2");
        expect(title).toHaveClass("custom-title");
    });

    it("should apply custom classNameText", () => {
        const { container } = render(
            <Title classNameText="custom-text">Title</Title>
        );

        const textSpan = container.querySelector("span");
        expect(textSpan).toHaveClass("custom-text");
    });
});

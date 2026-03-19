import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Text } from ".";

describe("Text", () => {
    it("should render body as <p> by default", () => {
        const { container } = render(<Text>Hello</Text>);
        expect(container.querySelector("p")).toBeTruthy();
    });

    it("should render heading1 as <h1>", () => {
        const { container } = render(<Text variant="heading1">Title</Text>);
        expect(container.querySelector("h1")).toBeTruthy();
    });

    it("should render heading2 as <h2>", () => {
        const { container } = render(<Text variant="heading2">Title</Text>);
        expect(container.querySelector("h2")).toBeTruthy();
    });

    it("should render heading3 as <h3>", () => {
        const { container } = render(<Text variant="heading3">Title</Text>);
        expect(container.querySelector("h3")).toBeTruthy();
    });

    it("should render heading4 as <h4>", () => {
        const { container } = render(<Text variant="heading4">Title</Text>);
        expect(container.querySelector("h4")).toBeTruthy();
    });

    it("should render caption as <span>", () => {
        const { container } = render(<Text variant="caption">note</Text>);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render label as <label>", () => {
        const { container } = render(<Text variant="label">Field</Text>);
        expect(container.querySelector("label")).toBeTruthy();
    });

    it("should render overline as <span>", () => {
        const { container } = render(<Text variant="overline">CATEGORY</Text>);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should override tag with as prop", () => {
        const { container } = render(
            <Text variant="heading1" as="span">
                Title
            </Text>
        );
        expect(container.querySelector("span")).toBeTruthy();
        expect(container.querySelector("h1")).toBeFalsy();
    });

    it("should forward className", () => {
        const { container } = render(<Text className="custom">Test</Text>);
        expect(container.querySelector(".custom")).toBeTruthy();
    });

    it("should render children", () => {
        render(<Text>Hello World</Text>);
        expect(screen.getByText("Hello World")).toBeTruthy();
    });
});

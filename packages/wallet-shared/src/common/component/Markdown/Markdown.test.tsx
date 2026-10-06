import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./index";

describe("Markdown", () => {
    it("should render markdown content", () => {
        render(<Markdown md="# Heading\n\nSome text" />);

        // Markdown is rendered as HTML, check for heading element
        const heading = screen.getByRole("heading", { level: 1 });
        expect(heading).toBeInTheDocument();
        expect(heading.textContent).toContain("Heading");
    });

    it("should render default text when md is not provided", () => {
        const { container } = render(<Markdown />);
        // Markdown renders "No description" as HTML
        expect(container.textContent).toContain("No description");
    });

    it("should render empty string", () => {
        const { container } = render(<Markdown md="" />);
        // `md ?? "No description"` keeps an empty string, which renders nothing
        expect(container.textContent).toBe("");
    });

    it("should render markdown with links", () => {
        render(<Markdown md="[Link](https://example.com)" />);

        const link = screen.getByRole("link", { name: "Link" });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "https://example.com");
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("should render markdown with multiple paragraphs", () => {
        const { container } = render(
            <Markdown md="Paragraph 1\n\nParagraph 2" />
        );

        // Markdown renders paragraphs, check text content
        expect(container.textContent).toContain("Paragraph 1");
        expect(container.textContent).toContain("Paragraph 2");
    });

    it("should render markdown with bold text", () => {
        render(<Markdown md="**Bold text**" />);

        const boldElement = screen.getByText("Bold text");
        expect(boldElement).toBeInTheDocument();
        // Bold is rendered as <strong> tag
        expect(boldElement.tagName).toBe("STRONG");
    });

    it("should render markdown with italic text", () => {
        render(<Markdown md="*Italic text*" />);

        const italicElement = screen.getByText("Italic text");
        expect(italicElement).toBeInTheDocument();
        // Italic is rendered as <em> tag
        expect(italicElement.tagName).toBe("EM");
    });

    it("should add target=_blank to all links", () => {
        render(
            <Markdown md="[Link 1](https://example.com) [Link 2](https://test.com)" />
        );

        const links = screen.getAllByRole("link");
        links.forEach((link) => {
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noopener noreferrer");
        });
    });

    it("should not render links with javascript: or data: URLs", () => {
        const { container } = render(
            <Markdown
                md={
                    "[bad](javascript:alert(1)) [worse](data:text/html,hi) [ref][r]\n\n[r]: javascript:alert(1)"
                }
            />
        );

        expect(container.querySelector("a")).toBeNull();
        expect(container.textContent).toContain("bad");
    });

    it("should escape raw HTML", () => {
        const { container } = render(
            <Markdown md="Hi <img src=x onerror=alert(1)>" />
        );

        expect(container.querySelector("img")).toBeNull();
        expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    });

    it("should render lists", () => {
        render(<Markdown md={"- a\n- b"} />);

        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardAccordion } from "./index";

describe("CardAccordion", () => {
    it("should render children within accordion when open", () => {
        render(
            <CardAccordion title="Test Panel" defaultValue="item-1">
                <div>Test Content</div>
            </CardAccordion>
        );

        expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should render with title", () => {
        render(
            <CardAccordion title="Test Panel Title">
                <div>Content</div>
            </CardAccordion>
        );

        expect(screen.getByText("Test Panel Title")).toBeInTheDocument();
    });

    it("should render accordion structure with data-state", () => {
        const { container } = render(
            <CardAccordion title="Test Panel" defaultValue="item-1">
                <div>Content</div>
            </CardAccordion>
        );

        // Accordion renders with data-state attribute
        const accordionItem = container.querySelector("[data-state]");
        expect(accordionItem).toBeInTheDocument();
    });

    it("should pass defaultValue prop to accordion", () => {
        const { container } = render(
            <CardAccordion title="Test Panel" defaultValue="item-1">
                <div>Content</div>
            </CardAccordion>
        );

        // When defaultValue is "item-1", accordion item should be open
        const accordionItem = container.querySelector('[data-state="open"]');
        expect(accordionItem).toBeInTheDocument();
    });

    it("should support controlled value prop", () => {
        const { container } = render(
            <CardAccordion title="Test Panel" value="item-1">
                <div>Content</div>
            </CardAccordion>
        );

        // When value is "item-1", accordion item should be open
        const accordionItem = container.querySelector('[data-state="open"]');
        expect(accordionItem).toBeInTheDocument();
    });
});

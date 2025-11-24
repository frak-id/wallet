import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PanelAccordion } from "./index";

describe("PanelAccordion", () => {
    it("should render children within accordion when open", () => {
        render(
            <PanelAccordion title="Test Panel" defaultValue="item-1">
                <div>Test Content</div>
            </PanelAccordion>
        );

        expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should render with title", () => {
        render(
            <PanelAccordion title="Test Panel Title">
                <div>Content</div>
            </PanelAccordion>
        );

        expect(screen.getByText("Test Panel Title")).toBeInTheDocument();
    });

    it("should render accordion structure with data-state", () => {
        const { container } = render(
            <PanelAccordion title="Test Panel" defaultValue="item-1">
                <div>Content</div>
            </PanelAccordion>
        );

        // Accordion renders with data-state attribute
        const accordionItem = container.querySelector("[data-state]");
        expect(accordionItem).toBeInTheDocument();
    });

    it("should pass defaultValue prop to accordion", () => {
        const { container } = render(
            <PanelAccordion title="Test Panel" defaultValue="item-1">
                <div>Content</div>
            </PanelAccordion>
        );

        // When defaultValue is "item-1", accordion item should be open
        const accordionItem = container.querySelector('[data-state="open"]');
        expect(accordionItem).toBeInTheDocument();
    });

    it("should support controlled value prop", () => {
        const { container } = render(
            <PanelAccordion title="Test Panel" value="item-1">
                <div>Content</div>
            </PanelAccordion>
        );

        // When value is "item-1", accordion item should be open
        const accordionItem = container.querySelector('[data-state="open"]');
        expect(accordionItem).toBeInTheDocument();
    });
});

/// <reference types="@testing-library/jest-dom" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "./index";

function renderAccordion({ defaultValue }: { defaultValue?: string } = {}) {
    return render(
        <Accordion type="single" collapsible defaultValue={defaultValue}>
            <AccordionItem value="item-1">
                <AccordionTrigger>Section 1</AccordionTrigger>
                <AccordionContent>Content 1</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger>Section 2</AccordionTrigger>
                <AccordionContent>Content 2</AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

describe("Accordion", () => {
    it("should render triggers", () => {
        renderAccordion();
        expect(
            screen.getByRole("button", { name: "Section 1" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Section 2" })
        ).toBeInTheDocument();
    });

    it("should expand content when trigger clicked", async () => {
        renderAccordion();
        const trigger = screen.getByRole("button", { name: "Section 1" });

        fireEvent.click(trigger);

        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeVisible();
        });
    });

    it("should render with defaultValue expanded", () => {
        renderAccordion({ defaultValue: "item-1" });
        expect(screen.getByText("Content 1")).toBeVisible();
    });

    it("should collapse when clicking an expanded trigger", async () => {
        renderAccordion({ defaultValue: "item-1" });
        const trigger = screen.getByRole("button", { name: "Section 1" });

        expect(trigger).toHaveAttribute("data-state", "open");

        fireEvent.click(trigger);

        await waitFor(() => {
            expect(trigger).toHaveAttribute("data-state", "closed");
        });
    });

    it("should render chevron icon in trigger", () => {
        renderAccordion();
        const trigger = screen.getByRole("button", { name: "Section 1" });
        const svg = trigger.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should render items with heading elements", () => {
        renderAccordion();
        const headings = screen.getAllByRole("heading", { level: 2 });
        expect(headings).toHaveLength(2);
    });

    it("should pass custom className to AccordionItem", () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="test" className="custom-class">
                    <AccordionTrigger>Test</AccordionTrigger>
                    <AccordionContent>Content</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Test" });
        // Item is a div ancestor of the heading > trigger hierarchy
        const heading = trigger.closest("h2");
        const item = heading?.parentElement;
        expect(item?.className).toContain("custom-class");
    });
});

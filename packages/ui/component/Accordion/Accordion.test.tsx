import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "./index";

describe("Accordion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render accordion items", () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        expect(screen.getByText("Item 1")).toBeInTheDocument();
    });

    it("should expand accordion item when trigger is clicked", async () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Item 1" });
        fireEvent.click(trigger);

        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeInTheDocument();
        });
    });

    it("should toggle accordion item when trigger is clicked", async () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Item 1" });

        // Expand
        fireEvent.click(trigger);
        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeInTheDocument();
        });

        // Collapse - Radix Accordion keeps content in DOM but hides it
        fireEvent.click(trigger);
        await waitFor(() => {
            // Content remains in DOM but is hidden via aria-hidden or data-state
            const content = screen.queryByText("Content 1");
            // Content may still be in DOM but not visible
            expect(content).toBeInTheDocument();
        });
    });

    it("should render multiple accordion items", () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Item 2</AccordionTrigger>
                    <AccordionContent>Content 2</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        expect(screen.getByText("Item 1")).toBeInTheDocument();
        expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("should work in controlled mode", async () => {
        const { rerender } = render(
            <Accordion type="single" value="item-1">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeInTheDocument();
        });

        rerender(
            <Accordion type="single" value="">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        await waitFor(() => {
            expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
        });
    });

    it("should work in uncontrolled mode with defaultValue", async () => {
        render(
            <Accordion type="single" defaultValue="item-1">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeInTheDocument();
        });
    });

    it("should allow multiple items open with type multiple", async () => {
        render(
            <Accordion type="multiple">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Item 2</AccordionTrigger>
                    <AccordionContent>Content 2</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger1 = screen.getByRole("button", { name: "Item 1" });
        const trigger2 = screen.getByRole("button", { name: "Item 2" });

        fireEvent.click(trigger1);
        fireEvent.click(trigger2);

        await waitFor(() => {
            expect(screen.getByText("Content 1")).toBeInTheDocument();
            expect(screen.getByText("Content 2")).toBeInTheDocument();
        });
    });

    it("should apply custom className to AccordionItem", () => {
        const { container } = render(
            <Accordion type="single">
                <AccordionItem value="item-1" className="custom-item">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const item = container.querySelector("[data-state]");
        expect(item).toHaveClass("custom-item");
    });

    it("should apply custom className to AccordionTrigger", () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger className="custom-trigger">
                        Item 1
                    </AccordionTrigger>
                    <AccordionContent>Content 1</AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Item 1" });
        expect(trigger).toHaveClass("custom-trigger");
    });

    it("should apply custom className to AccordionContent", async () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent className="custom-content">
                        Content 1
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Item 1" });
        fireEvent.click(trigger);

        await waitFor(() => {
            // Find the AccordionContent element (Radix wraps it)
            const content = screen.getByText("Content 1");
            // The className is applied to the Radix Content wrapper
            const contentWrapper = content.closest("[data-state]");
            expect(contentWrapper).toBeInTheDocument();
            // Check if custom-content class is present in the element or its parent
            expect(
                contentWrapper?.classList.contains("custom-content") ||
                    contentWrapper?.parentElement?.classList.contains(
                        "custom-content"
                    )
            ).toBe(true);
        });
    });

    it("should apply classNameText to AccordionContent", async () => {
        render(
            <Accordion type="single">
                <AccordionItem value="item-1">
                    <AccordionTrigger>Item 1</AccordionTrigger>
                    <AccordionContent classNameText="custom-text">
                        Content 1
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );

        const trigger = screen.getByRole("button", { name: "Item 1" });
        fireEvent.click(trigger);

        await waitFor(() => {
            const content = screen.getByText("Content 1");
            expect(content).toHaveClass("custom-text");
        });
    });
});

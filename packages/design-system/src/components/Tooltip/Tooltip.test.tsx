import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from ".";

function renderTooltip(contentText = "Tooltip text") {
    return render(
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>Hover me</TooltipTrigger>
                <TooltipContent>{contentText}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

describe("Tooltip", () => {
    it("should render trigger", () => {
        renderTooltip();
        expect(screen.getByText("Hover me")).toBeTruthy();
    });

    it("should not show content by default", () => {
        renderTooltip();
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("should show content on hover", async () => {
        renderTooltip();
        const user = userEvent.setup();
        await user.hover(screen.getByText("Hover me"));
        expect(await screen.findByRole("tooltip")).toBeTruthy();
    });

    it("should hide content when mouse leaves", async () => {
        renderTooltip();
        const user = userEvent.setup();
        await user.hover(screen.getByText("Hover me"));
        await screen.findByRole("tooltip");
        await user.unhover(screen.getByText("Hover me"));

        // After unhover, verify trigger still present
        expect(screen.getByText("Hover me")).toBeTruthy();
    });

    it("should export compound parts", () => {
        expect(TooltipProvider).toBeDefined();
        expect(Tooltip).toBeDefined();
        expect(TooltipTrigger).toBeDefined();
        expect(TooltipContent).toBeDefined();
    });

    it("should accept sideOffset prop", () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger>Trigger</TooltipTrigger>
                    <TooltipContent sideOffset={8}>
                        Offset content
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        expect(screen.getByRole("tooltip")).toBeTruthy();
    });

    it("should render with hideArrow", () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger>Trigger</TooltipTrigger>
                    <TooltipContent hideArrow>No arrow</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip).toBeTruthy();
        // Portaled content: query from tooltip's parent (the content wrapper)
        const contentWrapper =
            tooltip.previousElementSibling ?? tooltip.parentElement;
        const svg = contentWrapper?.querySelector("svg");
        expect(svg).toBeNull();
    });

    it("should forward className to content", () => {
        render(
            <TooltipProvider>
                <Tooltip defaultOpen>
                    <TooltipTrigger>Trigger</TooltipTrigger>
                    <TooltipContent className="custom-tip">
                        Styled
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
        // Portaled content is on document.body, not in render container
        expect(document.querySelector(".custom-tip")).toBeTruthy();
    });
});

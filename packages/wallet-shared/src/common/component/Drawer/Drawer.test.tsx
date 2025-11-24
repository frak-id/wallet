import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Drawer, DrawerContent, DrawerTrigger } from "./index";

describe("Drawer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render closed by default", () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>Drawer Content</DrawerContent>
            </Drawer>
        );

        // Drawer content should not be visible when closed
        expect(screen.queryByText("Drawer Content")).not.toBeInTheDocument();
    });

    it("should open when trigger is clicked", async () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>Drawer Content</DrawerContent>
            </Drawer>
        );

        const trigger = screen.getByRole("button", { name: "Open Drawer" });
        fireEvent.click(trigger);

        await waitFor(() => {
            expect(screen.getByText("Drawer Content")).toBeInTheDocument();
        });
    });

    it("should render overlay when drawer is open", async () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>Drawer Content</DrawerContent>
            </Drawer>
        );

        // Open drawer
        fireEvent.click(screen.getByRole("button", { name: "Open Drawer" }));

        await waitFor(() => {
            expect(screen.getByText("Drawer Content")).toBeInTheDocument();
        });

        // Overlay should be present (vaul creates it automatically)
        const overlay = document.querySelector("[data-vaul-overlay]");
        expect(overlay).toBeInTheDocument();
        // Note: Testing overlay click behavior is complex with vaul's gesture handling
        // The overlay click functionality is tested by the vaul library itself
    });

    it("should render content correctly when open", async () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>
                    <div>Test Content</div>
                    <p>More content</p>
                </DrawerContent>
            </Drawer>
        );

        fireEvent.click(screen.getByRole("button", { name: "Open Drawer" }));

        await waitFor(() => {
            expect(screen.getByText("Test Content")).toBeInTheDocument();
            expect(screen.getByText("More content")).toBeInTheDocument();
        });
    });

    it("should render DrawerContent with overlay", async () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        fireEvent.click(screen.getByRole("button", { name: "Open Drawer" }));

        await waitFor(() => {
            // Overlay should be present (vaul creates overlay automatically)
            const overlay = document.querySelector("[data-vaul-overlay]");
            expect(overlay).toBeInTheDocument();
        });
    });

    it("should work in controlled mode", async () => {
        const handleOpenChange = vi.fn();
        const { rerender } = render(
            <Drawer open={false} onOpenChange={handleOpenChange}>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        expect(screen.queryByText("Content")).not.toBeInTheDocument();

        rerender(
            <Drawer open={true} onOpenChange={handleOpenChange}>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        await waitFor(() => {
            expect(screen.getByText("Content")).toBeInTheDocument();
        });
    });

    it("should work in uncontrolled mode with defaultOpen", async () => {
        render(
            <Drawer defaultOpen={true}>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        await waitFor(() => {
            expect(screen.getByText("Content")).toBeInTheDocument();
        });
    });

    it("should call onOpenChange when drawer state changes", async () => {
        const handleOpenChange = vi.fn();
        render(
            <Drawer onOpenChange={handleOpenChange}>
                <DrawerTrigger asChild>
                    <button type="button">Open Drawer</button>
                </DrawerTrigger>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        fireEvent.click(screen.getByRole("button", { name: "Open Drawer" }));

        await waitFor(() => {
            expect(handleOpenChange).toHaveBeenCalledWith(true);
        });
    });

    it("should apply custom className to DrawerContent", async () => {
        render(
            <Drawer>
                <DrawerTrigger asChild>
                    <button type="button">Open</button>
                </DrawerTrigger>
                <DrawerContent className="custom-drawer">Content</DrawerContent>
            </Drawer>
        );

        fireEvent.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
            expect(drawer).toHaveClass("custom-drawer");
        });
    });

    it("should render with shouldScaleBackground prop", () => {
        render(
            <Drawer shouldScaleBackground={false}>
                <DrawerTrigger asChild>
                    <button type="button">Open</button>
                </DrawerTrigger>
                <DrawerContent>Content</DrawerContent>
            </Drawer>
        );

        expect(
            screen.getByRole("button", { name: "Open" })
        ).toBeInTheDocument();
    });
});

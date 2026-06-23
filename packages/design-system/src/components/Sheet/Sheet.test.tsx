import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetTitle,
    SheetTrigger,
} from "./index";

function renderSheet(
    open?: boolean,
    contentProps?: { hideCloseButton?: boolean }
) {
    return render(
        <Sheet defaultOpen={open}>
            <SheetTrigger>Open sheet</SheetTrigger>
            <SheetContent {...contentProps}>
                <SheetTitle>Sheet title</SheetTitle>
                <SheetDescription>Sheet description</SheetDescription>
                <SheetClose>Done</SheetClose>
            </SheetContent>
        </Sheet>
    );
}

describe("Sheet", () => {
    it("should render the trigger", () => {
        renderSheet();
        expect(screen.getByText("Open sheet")).toBeInTheDocument();
    });

    it("should not show content by default", () => {
        renderSheet();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should show content when opened via the trigger", async () => {
        renderSheet();
        await userEvent.click(screen.getByText("Open sheet"));
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("should render title and description when open", () => {
        renderSheet(true);
        expect(screen.getByText("Sheet title")).toBeInTheDocument();
        expect(screen.getByText("Sheet description")).toBeInTheDocument();
    });

    it("should render the built-in close button by default", () => {
        renderSheet(true);
        expect(
            screen.getByRole("button", { name: "Close" })
        ).toBeInTheDocument();
    });

    it("should hide the built-in close button when hideCloseButton is set", () => {
        renderSheet(true, { hideCloseButton: true });
        expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    });

    it("should expose the compound parts", () => {
        expect(Sheet).toBeDefined();
        expect(SheetTrigger).toBeDefined();
        expect(SheetContent).toBeDefined();
        expect(SheetTitle).toBeDefined();
        expect(SheetDescription).toBeDefined();
        expect(SheetClose).toBeDefined();
    });
});

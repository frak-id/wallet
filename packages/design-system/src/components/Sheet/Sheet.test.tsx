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
import { sheetContent } from "./sheet.css";

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

describe("sheetContent recipe", () => {
    const classesFor = (args?: Parameters<typeof sheetContent>[0]) =>
        sheetContent(args).split(" ").filter(Boolean);

    it("defaults to a right-side, default-size, padded sheet", () => {
        expect(sheetContent()).toBe(
            sheetContent({ side: "right", size: "default", padded: true })
        );
    });

    it("applies a size-specific width class on horizontal sheets only", () => {
        const topWide = classesFor({ side: "top", size: "wide" });
        const topDefault = classesFor({ side: "top", size: "default" });

        for (const side of ["right", "left"] as const) {
            const wide = classesFor({ side, size: "wide" });
            const dflt = classesFor({ side, size: "default" });
            // Beyond the shared size marker, wide must add exactly one
            // horizontal-only width class (the compound variant).
            const widthOnly = wide.filter(
                (c) => !dflt.includes(c) && !topWide.includes(c)
            );
            expect(widthOnly).toHaveLength(1);
        }

        // Vertical sheets ignore size: nothing beyond the shared size
        // marker (which horizontal wide sheets also carry) may change.
        const rightWide = classesFor({ side: "right", size: "wide" });
        const topOnlyDelta = topWide.filter(
            (c) => !topDefault.includes(c) && !rightWide.includes(c)
        );
        expect(topOnlyDelta).toHaveLength(0);

        const bottomWide = classesFor({ side: "bottom", size: "wide" });
        const bottomDefault = classesFor({ side: "bottom", size: "default" });
        const bottomOnlyDelta = bottomWide.filter(
            (c) => !bottomDefault.includes(c) && !rightWide.includes(c)
        );
        expect(bottomOnlyDelta).toHaveLength(0);
    });

    it("renders distinct classes per side", () => {
        const sides = ["top", "right", "bottom", "left"] as const;
        const results = sides.map((side) => sheetContent({ side }));
        expect(new Set(results).size).toBe(sides.length);
    });

    it("drops the padding class when padded is false", () => {
        const padded = classesFor({ padded: true });
        const unpadded = classesFor({ padded: false });
        const paddingOnly = padded.filter((c) => !unpadded.includes(c));
        expect(paddingOnly).toHaveLength(1);
    });
});

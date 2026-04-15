import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from ".";

function renderDialog(open?: boolean) {
    return render(
        <Dialog defaultOpen={open}>
            <DialogTrigger>Open dialog</DialogTrigger>
            <DialogContent>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>Dialog description</DialogDescription>
                <DialogClose>Close</DialogClose>
            </DialogContent>
        </Dialog>
    );
}

describe("Dialog", () => {
    it("should render trigger button", () => {
        renderDialog();
        expect(screen.getByText("Open dialog")).toBeTruthy();
    });

    it("should not show content by default", () => {
        renderDialog();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should show content when opened", async () => {
        renderDialog();
        const user = userEvent.setup();
        await user.click(screen.getByText("Open dialog"));
        expect(await screen.findByRole("dialog")).toBeTruthy();
    });

    it("should render title and description when open", () => {
        renderDialog(true);
        expect(screen.getByText("Dialog title")).toBeTruthy();
        expect(screen.getByText("Dialog description")).toBeTruthy();
    });

    it("should render overlay when open", () => {
        renderDialog(true);
        expect(document.querySelector("[data-testid='overlay']")).toBeTruthy();
    });

    it("should export compound parts", () => {
        expect(Dialog).toBeDefined();
        expect(DialogTrigger).toBeDefined();
        expect(DialogContent).toBeDefined();
        expect(DialogTitle).toBeDefined();
        expect(DialogDescription).toBeDefined();
        expect(DialogClose).toBeDefined();
    });

    it("should forward className to content", () => {
        render(
            <Dialog defaultOpen>
                <DialogContent className="custom-dialog">
                    <DialogTitle>Title</DialogTitle>
                    <DialogDescription>Desc</DialogDescription>
                </DialogContent>
            </Dialog>
        );
        expect(document.querySelector(".custom-dialog")).toBeTruthy();
    });
});

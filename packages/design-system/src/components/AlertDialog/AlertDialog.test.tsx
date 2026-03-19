import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    AlertDialogTrigger,
} from ".";

function renderAlertDialog(open?: boolean) {
    return render(
        <AlertDialog defaultOpen={open}>
            <AlertDialogTrigger>Delete item</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone.
                </AlertDialogDescription>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Confirm</AlertDialogAction>
            </AlertDialogContent>
        </AlertDialog>
    );
}

describe("AlertDialog", () => {
    it("should render trigger button", () => {
        renderAlertDialog();
        expect(screen.getByText("Delete item")).toBeTruthy();
    });

    it("should not show content by default", () => {
        renderAlertDialog();
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("should show content when opened", async () => {
        renderAlertDialog();
        const user = userEvent.setup();
        await user.click(screen.getByText("Delete item"));
        expect(await screen.findByRole("alertdialog")).toBeTruthy();
    });

    it("should render action and cancel buttons when open", () => {
        renderAlertDialog(true);
        expect(screen.getByText("Cancel")).toBeTruthy();
        expect(screen.getByText("Confirm")).toBeTruthy();
    });

    it("should render title and description when open", () => {
        renderAlertDialog(true);
        expect(screen.getByText("Are you sure?")).toBeTruthy();
        expect(screen.getByText("This action cannot be undone.")).toBeTruthy();
    });

    it("should render overlay when open", () => {
        renderAlertDialog(true);
        expect(document.querySelector("[data-testid='overlay']")).toBeTruthy();
    });

    it("should close when cancel is clicked", async () => {
        renderAlertDialog(true);
        const user = userEvent.setup();
        await user.click(screen.getByText("Cancel"));
        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("should close when action is clicked", async () => {
        const onOpenChange = vi.fn();
        render(
            <AlertDialog defaultOpen onOpenChange={onOpenChange}>
                <AlertDialogContent>
                    <AlertDialogTitle>Confirm</AlertDialogTitle>
                    <AlertDialogDescription>Sure?</AlertDialogDescription>
                    <AlertDialogAction>Yes</AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        );
        const user = userEvent.setup();
        await user.click(screen.getByText("Yes"));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should export compound parts", () => {
        expect(AlertDialog).toBeDefined();
        expect(AlertDialogTrigger).toBeDefined();
        expect(AlertDialogContent).toBeDefined();
        expect(AlertDialogTitle).toBeDefined();
        expect(AlertDialogDescription).toBeDefined();
        expect(AlertDialogAction).toBeDefined();
        expect(AlertDialogCancel).toBeDefined();
    });

    it("should forward className to content", () => {
        render(
            <AlertDialog defaultOpen>
                <AlertDialogContent className="custom-alert">
                    <AlertDialogTitle>Title</AlertDialogTitle>
                    <AlertDialogDescription>Desc</AlertDialogDescription>
                </AlertDialogContent>
            </AlertDialog>
        );
        expect(document.querySelector(".custom-alert")).toBeTruthy();
    });
});

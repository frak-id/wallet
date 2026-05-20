import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertDialog } from "./index";

describe("AlertDialog", () => {
    it("should render with title and description", () => {
        render(
            <AlertDialog
                title="Test Title"
                description="Test Description"
                open={true}
            />
        );

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(screen.getByText("Test Title")).toBeInTheDocument();
        expect(screen.getByText("Test Description")).toBeInTheDocument();
    });

    it("should render with a styled content element", () => {
        render(<AlertDialog title="Test" open={true} />);

        const content = screen.getByRole("alertdialog");
        expect(content.className.length).toBeGreaterThan(0);
    });

    it("should render with a styled title element", () => {
        render(<AlertDialog title="Test" open={true} />);

        const title = screen.getByText("Test");
        expect(title.className.length).toBeGreaterThan(0);
    });

    it("should render trigger button when label is provided", () => {
        render(<AlertDialog title="Test" button={{ label: "Open Dialog" }} />);

        expect(screen.getByText("Open Dialog")).toBeInTheDocument();
    });

    it("should render close button by default", () => {
        render(<AlertDialog title="Test" open={true} />);

        expect(screen.getByLabelText("Close")).toBeInTheDocument();
    });

    it("should not render close button when showCloseButton is false", () => {
        render(
            <AlertDialog title="Test" open={true} showCloseButton={false} />
        );

        expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
    });

    it("should pass through all props to shared AlertDialog", () => {
        const onOpenChange = vi.fn();
        render(
            <AlertDialog
                title="Test"
                description="Test Description"
                text="Additional text"
                open={true}
                onOpenChange={onOpenChange}
            />
        );

        expect(screen.getByText("Test Description")).toBeInTheDocument();
        expect(screen.getByText("Additional text")).toBeInTheDocument();
    });
});

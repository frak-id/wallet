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

    it("should render the close button", () => {
        render(<AlertDialog title="Test" open={true} />);

        expect(screen.getByLabelText("common.close")).toBeInTheDocument();
    });

    it("should render the text body", () => {
        render(<AlertDialog title="Test" text="Additional text" open={true} />);

        expect(screen.getByText("Additional text")).toBeInTheDocument();
    });
});

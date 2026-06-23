import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusBanner } from "./index";

describe("StatusBanner", () => {
    it("should render the title", () => {
        render(<StatusBanner title="Heads up" />);
        expect(screen.getByText("Heads up")).toBeInTheDocument();
    });

    it("should render the description when provided", () => {
        render(<StatusBanner title="Heads up" description="More detail" />);
        expect(screen.getByText("More detail")).toBeInTheDocument();
    });

    it("should default to the status role", () => {
        render(<StatusBanner title="Heads up" />);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should use the alert role when requested", () => {
        render(<StatusBanner title="Urgent" role="alert" />);
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("should render a custom icon", () => {
        render(
            <StatusBanner title="Heads up" icon={<span>custom-icon</span>} />
        );
        expect(screen.getByText("custom-icon")).toBeInTheDocument();
    });

    it("should not render a dismiss button without onDismiss", () => {
        render(<StatusBanner title="Heads up" />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("should render a dismiss button and call onDismiss when clicked", async () => {
        const onDismiss = vi.fn();
        render(
            <StatusBanner
                title="Heads up"
                onDismiss={onDismiss}
                dismissLabel="Dismiss"
            />
        );
        const button = screen.getByRole("button", { name: "Dismiss" });
        await userEvent.click(button);
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});

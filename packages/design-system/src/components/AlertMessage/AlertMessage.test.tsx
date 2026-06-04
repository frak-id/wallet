import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AlertMessage } from ".";

const icon = <span data-testid="icon">!</span>;

describe("AlertMessage", () => {
    it("renders the title and description with an alert role", () => {
        const { container } = render(
            <AlertMessage
                tone="danger"
                icon={icon}
                title="Something went wrong"
                description="Please try again."
            />
        );
        expect(screen.getByText("Something went wrong")).toBeTruthy();
        expect(screen.getByText("Please try again.")).toBeTruthy();
        expect(container.querySelector('[role="alert"]')).toBeTruthy();
        expect(screen.getByTestId("icon")).toBeTruthy();
    });

    it("renders ordered guidance steps", () => {
        render(
            <AlertMessage
                tone="warning"
                icon={icon}
                title="Sync issue"
                steps={["First step", "Second step", "Third step"]}
            />
        );
        expect(screen.getByText("First step")).toBeTruthy();
        expect(screen.getByText("Third step")).toBeTruthy();
        expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("invokes the action handler", () => {
        const onClick = vi.fn();
        render(
            <AlertMessage
                tone="danger"
                icon={icon}
                title="Failed"
                action={{ label: "Try again", onClick }}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("renders the close button only when onDismiss is set", () => {
        const onDismiss = vi.fn();
        const { rerender } = render(
            <AlertMessage tone="neutral" icon={icon} title="Info" />
        );
        expect(screen.queryByRole("button")).toBeNull();

        rerender(
            <AlertMessage
                tone="neutral"
                icon={icon}
                title="Info"
                onDismiss={onDismiss}
                dismissLabel="Dismiss"
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});

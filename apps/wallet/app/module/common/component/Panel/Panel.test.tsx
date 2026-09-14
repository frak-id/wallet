import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./index";

describe("Panel", () => {
    it("should render children", () => {
        render(
            <Panel>
                <div data-testid="child">Child content</div>
            </Panel>
        );

        expect(screen.getByTestId("child")).toBeInTheDocument();
        expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Panel className="custom-panel">Content</Panel>
        );

        const panel = container.firstChild;
        expect(panel).toHaveClass("custom-panel");
    });
});

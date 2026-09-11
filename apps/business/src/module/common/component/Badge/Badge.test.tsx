import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./index";

describe("Badge", () => {
    it("should render with text content", () => {
        render(<Badge>Badge text</Badge>);

        expect(screen.getByText("Badge text")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Badge className="custom-badge">Badge</Badge>
        );

        const badge = container.querySelector("span");
        expect(badge).toHaveClass("custom-badge");
    });
});

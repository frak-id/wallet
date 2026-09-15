import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "./index";

describe("Separator", () => {
    it("should not be decorative when decorative is false", () => {
        const { container } = render(<Separator decorative={false} />);

        const separator = container.querySelector('[role="separator"]');
        expect(separator).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Separator className="custom-separator" />
        );

        const separator = container.firstChild as HTMLElement;
        expect(separator).toBeInTheDocument();
        expect(separator?.className).toContain("custom-separator");
    });
});

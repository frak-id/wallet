import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeltaIndicator } from "./index";

describe("DeltaIndicator", () => {
    it("renders an up arrow + signed value for a positive delta", () => {
        const { container } = render(<DeltaIndicator delta={12} />);
        expect(container.textContent).toContain("▲");
        expect(container.textContent).toContain("+12%");
        expect(container.textContent).not.toContain("▼");
    });

    it("renders a down arrow + value for a negative delta", () => {
        const { container } = render(<DeltaIndicator delta={-5} />);
        expect(container.textContent).toContain("▼");
        expect(container.textContent).toContain("-5%");
        expect(container.textContent).not.toContain("▲");
    });

    it("renders no arrow and no sign for a zero delta (neutral)", () => {
        const { container } = render(<DeltaIndicator delta={0} />);
        expect(container.textContent).not.toContain("▲");
        expect(container.textContent).not.toContain("▼");
        expect(container.textContent).toBe("0%");
    });

    it("marks the arrow glyph as decorative (aria-hidden)", () => {
        const { container } = render(<DeltaIndicator delta={3} />);
        const hidden = container.querySelector('[aria-hidden="true"]');
        expect(hidden?.textContent).toBe("▲");
    });
});

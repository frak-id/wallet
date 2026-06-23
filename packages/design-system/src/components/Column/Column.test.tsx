import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Column } from "./index";

describe("Column", () => {
    it("should render its children", () => {
        render(<Column>cell</Column>);
        expect(screen.getByText("cell")).toBeInTheDocument();
    });

    it("should apply explicit flex shorthand for fractional widths", () => {
        render(<Column width="1/2">half</Column>);
        expect(screen.getByText("half")).toHaveStyle({ flex: "0 0 50%" });
    });

    it("should map every fraction to a 0-grow / 0-shrink basis", () => {
        const { rerender } = render(<Column width="1/3">frac</Column>);
        expect(screen.getByText("frac")).toHaveStyle({ flex: "0 0 33.333%" });

        rerender(<Column width="3/4">frac</Column>);
        expect(screen.getByText("frac")).toHaveStyle({ flex: "0 0 75%" });
    });

    it("should not set an explicit flex for content width", () => {
        render(<Column width="content">natural</Column>);
        expect(screen.getByText("natural").style.flex).toBe("");
    });

    it("should not set an explicit flex when no width is provided", () => {
        render(<Column>fill</Column>);
        expect(screen.getByText("fill").style.flex).toBe("");
    });
});

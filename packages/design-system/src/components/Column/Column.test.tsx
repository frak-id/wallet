import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Column } from "./index";

describe("Column", () => {
    it("should render its children", () => {
        render(<Column>cell</Column>);
        expect(screen.getByText("cell")).toBeInTheDocument();
    });

    it("should apply a gap-aware grow share for fractional widths", () => {
        render(<Column width="1/2">half</Column>);
        expect(screen.getByText("half")).toHaveStyle({ flex: "1 1 0%" });
    });

    it("should set min-width: 0 so a column can shrink below its content (overflow fix)", () => {
        const { rerender } = render(<Column width="1/2">half</Column>);
        expect(screen.getByText("half")).toHaveStyle({ minWidth: "0px" });

        rerender(<Column>fill</Column>);
        expect(screen.getByText("fill")).toHaveStyle({ minWidth: "0px" });
    });

    it("should split a composed row by grow share (1/3 + 2/3 → 1 vs 2)", () => {
        render(
            <>
                <Column width="1/3">third</Column>
                <Column width="2/3">twoThirds</Column>
            </>
        );
        // basis 0 + grow 1 vs 2 → the row divides 1:2, gap-aware
        expect(screen.getByText("third")).toHaveStyle({ flex: "1 1 0%" });
        expect(screen.getByText("twoThirds")).toHaveStyle({ flex: "2 1 0%" });
    });

    it("should map each fraction to its numerator grow share with a zero basis", () => {
        const { rerender } = render(<Column width="1/3">frac</Column>);
        expect(screen.getByText("frac")).toHaveStyle({ flex: "1 1 0%" });

        rerender(<Column width="2/3">frac</Column>);
        expect(screen.getByText("frac")).toHaveStyle({ flex: "2 1 0%" });

        rerender(<Column width="3/4">frac</Column>);
        expect(screen.getByText("frac")).toHaveStyle({ flex: "3 1 0%" });
    });

    it("should not set an explicit flex for content width", () => {
        render(<Column width="content">natural</Column>);
        expect(screen.getByText("natural").style.flex).toBe("");
    });

    it("should fill with a single grow share when no width is provided", () => {
        render(<Column>fill</Column>);
        expect(screen.getByText("fill")).toHaveStyle({ flex: "1 1 0%" });
    });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { iconCircleSizes } from "./iconCircle.css";
import { IconCircle } from "./index";

describe("IconCircle", () => {
    it("should render its children", () => {
        render(<IconCircle>icon</IconCircle>);
        expect(screen.getByText("icon")).toBeInTheDocument();
    });

    it("should default to the medium size class", () => {
        render(<IconCircle>icon</IconCircle>);
        expect(screen.getByText("icon").className).toContain(
            iconCircleSizes.md
        );
    });

    it("should apply the requested size class", () => {
        render(<IconCircle size="lg">icon</IconCircle>);
        expect(screen.getByText("icon").className).toContain(
            iconCircleSizes.lg
        );
    });

    it("should merge a custom className", () => {
        render(<IconCircle className="extra">icon</IconCircle>);
        const cn = screen.getByText("icon").className;
        expect(cn).toContain(iconCircleSizes.md);
        expect(cn).toContain("extra");
    });
});

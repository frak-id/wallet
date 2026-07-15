import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { iconCircle } from "./iconCircle.css";
import { IconCircle } from "./index";

const classesFor = (args: Parameters<typeof iconCircle>[0]) =>
    iconCircle(args).split(" ").filter(Boolean);

describe("IconCircle", () => {
    it("should render its children", () => {
        render(<IconCircle>icon</IconCircle>);
        expect(screen.getByText("icon")).toBeInTheDocument();
    });

    it("should default to the medium size class", () => {
        render(<IconCircle>icon</IconCircle>);
        const cn = screen.getByText("icon").className;
        for (const c of classesFor({ size: "md", tone: "neutral" })) {
            expect(cn).toContain(c);
        }
    });

    it("should apply the requested size class", () => {
        render(<IconCircle size="lg">icon</IconCircle>);
        const cn = screen.getByText("icon").className;
        for (const c of classesFor({ size: "lg", tone: "neutral" })) {
            expect(cn).toContain(c);
        }
        // The md-specific size class must be gone once lg is requested.
        const mdOnly = classesFor({ size: "md" }).find(
            (c) => !classesFor({ size: "lg" }).includes(c)
        );
        expect(mdOnly).toBeDefined();
        expect(cn).not.toContain(mdOnly);
    });

    it("should merge a custom className", () => {
        render(<IconCircle className="extra">icon</IconCircle>);
        const cn = screen.getByText("icon").className;
        for (const c of classesFor({ size: "md", tone: "neutral" })) {
            expect(cn).toContain(c);
        }
        expect(cn).toContain("extra");
    });
});

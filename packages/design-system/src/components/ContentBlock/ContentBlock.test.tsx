/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentBlock } from "./index";

describe("ContentBlock", () => {
    it("renders children", () => {
        render(<ContentBlock maxWidth="800px">inner</ContentBlock>);
        expect(screen.getByText("inner")).toBeTruthy();
    });

    it("applies maxWidth via inline style", () => {
        render(<ContentBlock maxWidth="850px">content</ContentBlock>);
        const el = screen.getByText("content");
        expect(el.style.maxWidth).toBe("850px");
    });

    it("applies width:100% via inline style", () => {
        render(<ContentBlock maxWidth="600px">block</ContentBlock>);
        const el = screen.getByText("block");
        expect(el.style.width).toBe("100%");
    });

    it("centers by default (marginInline:auto)", () => {
        render(<ContentBlock maxWidth="600px">centered</ContentBlock>);
        const el = screen.getByText("centered");
        expect(el.style.marginInline).toBe("auto");
    });

    it("does not add marginInline when align=left", () => {
        render(
            <ContentBlock maxWidth="600px" align="left">
                left
            </ContentBlock>
        );
        const el = screen.getByText("left");
        expect(el.style.marginInline).toBe("");
    });

    it("forwards className alongside the base styles", () => {
        render(
            <ContentBlock maxWidth="600px" className="extra">
                classed
            </ContentBlock>
        );
        expect(screen.getByText("classed").className).toContain("extra");
    });

    it("renders the given element tag via as prop", () => {
        render(
            <ContentBlock maxWidth="600px" as="section">
                sectioned
            </ContentBlock>
        );
        expect(screen.getByText("sectioned").tagName).toBe("SECTION");
    });
});

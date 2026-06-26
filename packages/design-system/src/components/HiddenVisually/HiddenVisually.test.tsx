/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { visuallyHidden } from "../../reset.css";
import { HiddenVisually } from "./index";

describe("HiddenVisually", () => {
    it("renders a span containing children", () => {
        render(<HiddenVisually>hidden text</HiddenVisually>);
        const el = screen.getByText("hidden text");
        expect(el.tagName).toBe("SPAN");
    });

    it("applies the visuallyHidden class", () => {
        render(<HiddenVisually>content</HiddenVisually>);
        const el = screen.getByText("content");
        expect(el.className.split(" ")).toContain(visuallyHidden);
    });

    it("forwards the id prop", () => {
        render(<HiddenVisually id="label-id">label</HiddenVisually>);
        expect(screen.getByText("label").id).toBe("label-id");
    });

    it("merges a custom className with the visuallyHidden class", () => {
        render(<HiddenVisually className="extra">merged</HiddenVisually>);
        const classes = screen.getByText("merged").className.split(" ");
        expect(classes).toContain("extra");
        expect(classes).toContain(visuallyHidden);
    });
});

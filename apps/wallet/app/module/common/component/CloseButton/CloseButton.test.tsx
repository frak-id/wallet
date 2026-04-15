import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloseButton } from "./index";

describe("CloseButton", () => {
    it("should render a custom icon size when provided", () => {
        render(<CloseButton ariaLabel="Close" iconSize={24} />);

        const icon = screen
            .getByRole("button", { name: "Close" })
            .querySelector("svg");

        expect(icon).toHaveAttribute("width", "24");
        expect(icon).toHaveAttribute("height", "24");
    });
});

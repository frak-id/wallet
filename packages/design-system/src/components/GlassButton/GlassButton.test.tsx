import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GlassButton } from "./index";

describe("GlassButton", () => {
    it("should render the provided icon", () => {
        render(<GlassButton icon={<span>star</span>} />);
        expect(screen.getByText("star")).toBeInTheDocument();
    });

    it("should render a span by default (safe to nest in links)", () => {
        render(<GlassButton icon={<span>star</span>} />);
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("should render a real button when as='button'", () => {
        render(<GlassButton as="button" icon={<span>star</span>} />);
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should fire onClick when rendered as a button", async () => {
        const onClick = vi.fn();
        render(
            <GlassButton
                as="button"
                icon={<span>star</span>}
                onClick={onClick}
            />
        );
        await userEvent.click(screen.getByRole("button"));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("should reflect disabled state on the button", () => {
        render(<GlassButton as="button" disabled icon={<span>star</span>} />);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should mark the span variant aria-disabled when disabled", () => {
        render(<GlassButton disabled icon={<span>star</span>} />);
        expect(
            screen.getByText("star").closest("[aria-disabled='true']")
        ).not.toBeNull();
    });
});

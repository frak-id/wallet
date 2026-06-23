import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GlassCloseButton } from "./index";

describe("GlassCloseButton", () => {
    it("should render a button with the supplied accessible name", () => {
        render(<GlassCloseButton aria-label="Close" onClick={vi.fn()} />);
        expect(
            screen.getByRole("button", { name: "Close" })
        ).toBeInTheDocument();
    });

    it("should call onClick when pressed", async () => {
        const onClick = vi.fn();
        render(<GlassCloseButton aria-label="Close" onClick={onClick} />);
        await userEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("should be disabled when disabled is set", () => {
        render(
            <GlassCloseButton aria-label="Close" disabled onClick={vi.fn()} />
        );
        expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    });
});

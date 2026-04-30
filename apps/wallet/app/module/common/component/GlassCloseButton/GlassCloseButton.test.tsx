import { fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlassCloseButton } from "./index";

describe("GlassCloseButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Query inside the freshly rendered container — concurrent test DOMs
    // and `LiquidGlassBase`'s own internal markup can otherwise leak
    // matching elements into a screen-wide query.
    const renderGlassCloseButton = (
        props: Parameters<typeof GlassCloseButton>[0]
    ) => {
        const utils = render(<GlassCloseButton {...props} />);
        const button = within(utils.container).getByRole("button");
        return { ...utils, button };
    };

    it("renders as a button", () => {
        const { button } = renderGlassCloseButton({ onClick: () => {} });
        expect(button).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
        const handleClick = vi.fn();
        const { button } = renderGlassCloseButton({ onClick: handleClick });

        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("is disabled when the disabled prop is true", () => {
        const handleClick = vi.fn();
        const { button } = renderGlassCloseButton({
            onClick: handleClick,
            disabled: true,
        });

        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it("uses the translated `common.close` aria-label by default", () => {
        const { button } = renderGlassCloseButton({ onClick: () => {} });
        expect(button.getAttribute("aria-label")).toBe("common.close");
    });

    it("respects a custom label override", () => {
        const { button } = renderGlassCloseButton({
            onClick: () => {},
            label: "Close detail",
        });
        expect(button.getAttribute("aria-label")).toBe("Close detail");
    });

    it("renders the close (X) icon", () => {
        const { container } = render(<GlassCloseButton onClick={() => {}} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });
});

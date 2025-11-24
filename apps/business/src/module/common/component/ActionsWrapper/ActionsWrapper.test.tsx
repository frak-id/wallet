import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionsWrapper } from "./index";

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({ children, variant, className }: any) => (
        <div data-testid="panel" data-variant={variant} className={className}>
            {children}
        </div>
    ),
}));

describe("ActionsWrapper", () => {
    it("should render left section", () => {
        render(
            <ActionsWrapper
                left={<span data-testid="left">Left action</span>}
            />
        );

        expect(screen.getByTestId("left")).toBeInTheDocument();
    });

    it("should render right section", () => {
        render(
            <ActionsWrapper
                right={<span data-testid="right">Right action</span>}
            />
        );

        expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("should render both left and right sections", () => {
        render(
            <ActionsWrapper
                left={<span data-testid="left">Left</span>}
                right={<span data-testid="right">Right</span>}
            />
        );

        expect(screen.getByTestId("left")).toBeInTheDocument();
        expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("should render with secondary variant", () => {
        render(<ActionsWrapper left={<span>Left</span>} />);

        const panel = screen.getByTestId("panel");
        expect(panel).toHaveAttribute("data-variant", "secondary");
    });

    it("should not render sections when not provided", () => {
        const { container } = render(<ActionsWrapper />);

        expect(
            container.querySelector('[data-testid="left"]')
        ).not.toBeInTheDocument();
        expect(
            container.querySelector('[data-testid="right"]')
        ).not.toBeInTheDocument();
    });
});

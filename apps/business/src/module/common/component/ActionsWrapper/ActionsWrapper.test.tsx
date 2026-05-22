import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionsWrapper } from "./index";

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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Box } from "./index";

describe("Box", () => {
    it("renders with default props", () => {
        render(<Box data-testid="box">content</Box>);
        const el = screen.getByTestId("box");
        expect(el.tagName).toBe("DIV");
        expect(el).toBeInTheDocument();
    });

    it("renders children", () => {
        render(<Box>hello world</Box>);
        expect(screen.getByText("hello world")).toBeInTheDocument();
    });

    it("merges external className", () => {
        render(
            <Box className="custom-class" data-testid="box">
                content
            </Box>
        );
        expect(screen.getByTestId("box")).toHaveClass("custom-class");
    });

    it("passes through HTML attributes", () => {
        render(
            <Box aria-label="test box" data-testid="box">
                content
            </Box>
        );
        expect(screen.getByTestId("box")).toHaveAttribute(
            "aria-label",
            "test box"
        );
    });

    it("renders each padding variant", () => {
        const variants = ["none", "xs", "s", "m", "l", "xl"] as const;
        for (const v of variants) {
            const { unmount } = render(
                <Box padding={v} data-testid={`box-${v}`}>
                    x
                </Box>
            );
            expect(screen.getByTestId(`box-${v}`)).toBeInTheDocument();
            unmount();
        }
    });

    it("renders each gap variant", () => {
        const variants = ["none", "xs", "s", "m", "l", "xl"] as const;
        for (const v of variants) {
            const { unmount } = render(
                <Box gap={v} data-testid={`box-${v}`}>
                    x
                </Box>
            );
            expect(screen.getByTestId(`box-${v}`)).toBeInTheDocument();
            unmount();
        }
    });

    it("renders each direction variant", () => {
        const variants = ["row", "column"] as const;
        for (const v of variants) {
            const { unmount } = render(
                <Box direction={v} data-testid={`box-${v}`}>
                    x
                </Box>
            );
            expect(screen.getByTestId(`box-${v}`)).toBeInTheDocument();
            unmount();
        }
    });
});

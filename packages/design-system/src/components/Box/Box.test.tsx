import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { base, element } from "@/reset.css";

import { Box } from "./index";

describe("Box", () => {
    it("should render as div by default with children", () => {
        render(<Box>test content</Box>);
        expect(screen.getByText("test content")).toBeInTheDocument();
        expect(screen.getByText("test content").tagName).toBe("DIV");
    });

    it("should apply sprinkles classes when props provided", () => {
        render(
            <Box display="flex" gap="m" padding="l">
                styled
            </Box>
        );
        const el = screen.getByText("styled");
        expect(el.className).toBeTruthy();
    });

    it("should render as a different element when `as` prop is provided", () => {
        render(<Box as="ul">list</Box>);
        expect(screen.getByText("list").tagName).toBe("UL");
    });

    it("should pass through HTML attributes like onClick and role", () => {
        const handleClick = vi.fn();
        render(
            <Box onClick={handleClick} role="button">
                click me
            </Box>
        );
        const el = screen.getByRole("button");
        fireEvent.click(el);
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should accept aria-label without type error", () => {
        render(<Box aria-label="accessible box">content</Box>);
        expect(screen.getByLabelText("accessible box")).toBeInTheDocument();
    });

    it("should accept ref prop (React 19)", () => {
        let capturedRef: HTMLElement | null = null;
        render(
            <Box
                ref={(el) => {
                    capturedRef = el;
                }}
            >
                ref content
            </Box>
        );
        expect(capturedRef).not.toBeNull();
    });

    describe("reset", () => {
        it("should apply base reset class to default div", () => {
            render(<Box>content</Box>);
            expect(screen.getByText("content").className).toContain(base);
        });

        it("should apply element-specific reset for button", () => {
            render(<Box as="button">click</Box>);
            const cn = screen.getByText("click").className;
            expect(cn).toContain(base);
            expect(cn).toContain(element.button);
        });

        it("should apply element-specific reset for anchor", () => {
            render(<Box as="a">link</Box>);
            const cn = screen.getByText("link").className;
            expect(cn).toContain(base);
            expect(cn).toContain(element.a);
        });

        it("should apply list reset for ul", () => {
            render(<Box as="ul">list</Box>);
            const cn = screen.getByText("list").className;
            expect(cn).toContain(base);
            expect(cn).toContain(element.ul);
        });

        it("should only apply base when element has no specific reset", () => {
            render(<Box as="span">text</Box>);
            const cn = screen.getByText("text").className;
            expect(cn).toContain(base);
            for (const resetClass of Object.values(element)) {
                expect(cn).not.toContain(resetClass);
            }
        });
    });
});

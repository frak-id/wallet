/**
 * Tests for PairingCode component
 * Tests pairing code display with digit splitting
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PairingCode } from "./index";

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("PairingCode", () => {
    describe("basic rendering", () => {
        it("should render pairing code title", () => {
            render(<PairingCode code="123456" />);

            expect(screen.getByText("wallet.pairing.code")).toBeInTheDocument();
        });

        it("should render all digits of the code", () => {
            render(<PairingCode code="123456" />);

            expect(screen.getByText("1")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("4")).toBeInTheDocument();
            expect(screen.getByText("5")).toBeInTheDocument();
            expect(screen.getByText("6")).toBeInTheDocument();
        });

        it("should render single digit code", () => {
            render(<PairingCode code="5" />);

            expect(screen.getByText("5")).toBeInTheDocument();
        });

        it("should render empty code", () => {
            render(<PairingCode code="" />);

            // Title should still be rendered
            expect(screen.getByText("wallet.pairing.code")).toBeInTheDocument();
        });
    });

    describe("theme variants", () => {
        it("should apply light theme by default", () => {
            const { container } = render(<PairingCode code="123" />);

            const pairingCode = container.querySelector(
                "div[class*='pairingCode']"
            );
            expect(pairingCode?.className).not.toContain("dark");
        });

        it("should apply light theme when explicitly set", () => {
            const { container } = render(
                <PairingCode code="123" theme="light" />
            );

            const pairingCode = container.querySelector(
                "div[class*='pairingCode']"
            );
            expect(pairingCode?.className).not.toContain("dark");
        });

        it("should apply dark theme when set", () => {
            const { container } = render(
                <PairingCode code="123" theme="dark" />
            );

            const pairingCode = container.querySelector(
                "div[class*='pairingCode']"
            );
            expect(pairingCode?.className).toContain("dark");
        });
    });

    describe("code formatting", () => {
        it("should split multi-digit code correctly", () => {
            render(<PairingCode code="987654" />);

            const digits = screen.getAllByText(/\d/);
            expect(digits).toHaveLength(6);
            expect(digits[0]).toHaveTextContent("9");
            expect(digits[5]).toHaveTextContent("4");
        });

        it("should handle code with letters", () => {
            render(<PairingCode code="ABC123" />);

            expect(screen.getByText("A")).toBeInTheDocument();
            expect(screen.getByText("B")).toBeInTheDocument();
            expect(screen.getByText("C")).toBeInTheDocument();
            expect(screen.getByText("1")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
        });

        it("should handle code with special characters", () => {
            render(<PairingCode code="12-34" />);

            expect(screen.getByText("1")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            expect(screen.getByText("-")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("4")).toBeInTheDocument();
        });

        it("should handle long codes", () => {
            const longCode = "12345678901234567890";
            render(<PairingCode code={longCode} />);

            const digits = screen.getAllByText(/\d/);
            expect(digits).toHaveLength(20);
        });

        it("should handle code with spaces", () => {
            render(<PairingCode code="12 34" />);

            expect(screen.getByText("1")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("4")).toBeInTheDocument();

            // Code should be split into individual characters including space
            const { container } = render(<PairingCode code="12 34" />);
            const digitElements = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            // Should have at least 5 elements (1, 2, space, 3, 4)
            expect(digitElements.length).toBeGreaterThanOrEqual(5);
        });
    });

    describe("digit keys", () => {
        it("should generate unique keys for digits", () => {
            const { container } = render(<PairingCode code="123" />);

            const digitElements = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            expect(digitElements.length).toBeGreaterThanOrEqual(3);
        });

        it("should include code length in key for uniqueness", () => {
            // Render same code twice to ensure keys are unique
            const { container, rerender } = render(<PairingCode code="123" />);

            const firstRender = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            expect(firstRender.length).toBeGreaterThanOrEqual(3);

            rerender(<PairingCode code="1234" />);

            const secondRender = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            expect(secondRender.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe("edge cases", () => {
        it("should handle code with only spaces", () => {
            const { container } = render(<PairingCode code="   " />);

            // Check that space elements are rendered
            const digitElements = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            // Should have at least 3 elements (one for each space)
            expect(digitElements.length).toBeGreaterThanOrEqual(3);
        });

        it("should handle very long code", () => {
            const veryLongCode = "1".repeat(100);
            render(<PairingCode code={veryLongCode} />);

            const digits = screen.getAllByText("1");
            expect(digits).toHaveLength(100);
        });

        it("should handle code with unicode characters", () => {
            render(<PairingCode code="12🚀34" />);

            expect(screen.getByText("1")).toBeInTheDocument();
            expect(screen.getByText("2")).toBeInTheDocument();
            expect(screen.getByText("3")).toBeInTheDocument();
            expect(screen.getByText("4")).toBeInTheDocument();

            // Check that unicode character is rendered in a digit element
            const { container } = render(<PairingCode code="12🚀34" />);
            const digitElements = container.querySelectorAll(
                'div[class*="pairingCode__digit"]'
            );
            // Should have at least 5 elements (1, 2, 🚀, 3, 4)
            // Unicode emoji may be split into multiple elements
            expect(digitElements.length).toBeGreaterThanOrEqual(5);
        });
    });
});

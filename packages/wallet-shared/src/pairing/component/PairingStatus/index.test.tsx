/**
 * Tests for PairingStatus component
 * Tests pairing status display with different states
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PairingStatus } from "./index";

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock UI components
vi.mock("@frak-labs/ui/component/Spinner", () => ({
    Spinner: () => <div data-testid="spinner">Loading</div>,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
    Check: ({ color, size }: { color: string; size: number }) => (
        <div data-testid="check-icon" data-color={color} data-size={size}>
            Check
        </div>
    ),
}));

describe("PairingStatus", () => {
    describe("status display", () => {
        it("should display idle status", () => {
            render(<PairingStatus status="idle" />);

            expect(
                screen.getByText("wallet.pairing.status.idle")
            ).toBeInTheDocument();
        });

        it("should display connecting status with spinner", () => {
            render(<PairingStatus status="connecting" />);

            expect(screen.getByTestId("spinner")).toBeInTheDocument();
            expect(
                screen.getByText("wallet.pairing.status.connecting")
            ).toBeInTheDocument();
        });

        it("should display paired status with check icon", () => {
            render(<PairingStatus status="paired" />);

            const checkIcon = screen.getByTestId("check-icon");
            expect(checkIcon).toBeInTheDocument();
            expect(checkIcon).toHaveAttribute("data-color", "green");
            expect(checkIcon).toHaveAttribute("data-size", "16");
            expect(
                screen.getByText("wallet.pairing.status.paired")
            ).toBeInTheDocument();
        });
    });

    describe("component structure", () => {
        it("should render with correct className", () => {
            const { container } = render(<PairingStatus status="idle" />);

            const statusElement = container.querySelector(
                '[class*="pairingStatus"]'
            );
            expect(statusElement).toBeInTheDocument();
        });

        it("should render connecting status with connecting className", () => {
            const { container } = render(<PairingStatus status="connecting" />);

            const connectingElement = container.querySelector(
                '[class*="pairingStatus__connecting"]'
            );
            expect(connectingElement).toBeInTheDocument();
        });

        it("should render paired status with paired className", () => {
            const { container } = render(<PairingStatus status="paired" />);

            const pairedElement = container.querySelector(
                '[class*="pairingStatus__paired"]'
            );
            expect(pairedElement).toBeInTheDocument();
        });
    });

    describe("edge cases", () => {
        it("should handle all status values", () => {
            const statuses: Array<"idle" | "connecting" | "paired"> = [
                "idle",
                "connecting",
                "paired",
            ];

            statuses.forEach((status) => {
                const { unmount } = render(<PairingStatus status={status} />);

                expect(
                    screen.getByText(`wallet.pairing.status.${status}`, {
                        exact: false,
                    })
                ).toBeInTheDocument();

                unmount();
            });
        });

        it("should render connecting status with both spinner and text", () => {
            render(<PairingStatus status="connecting" />);

            expect(screen.getByTestId("spinner")).toBeInTheDocument();
            expect(
                screen.getByText("wallet.pairing.status.connecting")
            ).toBeInTheDocument();
        });

        it("should render paired status with both icon and text", () => {
            render(<PairingStatus status="paired" />);

            expect(screen.getByTestId("check-icon")).toBeInTheDocument();
            expect(
                screen.getByText("wallet.pairing.status.paired")
            ).toBeInTheDocument();
        });
    });
});

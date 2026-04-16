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
vi.mock("@frak-labs/design-system/components/Spinner", () => ({
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

    describe("edge cases", () => {
        it("should handle all status values", () => {
            const statuses: Array<"idle" | "connecting" | "paired"> = [
                "idle",
                "connecting",
                "paired",
            ];

            for (const status of statuses) {
                const { container, unmount } = render(
                    <PairingStatus status={status} />
                );

                expect(container).toHaveTextContent(
                    `wallet.pairing.status.${status}`
                );

                unmount();
            }
        });
    });
});

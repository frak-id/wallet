/**
 * Tests for PairingStatusBox components
 * Tests status display components for pairing process
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    StatusBoxModal,
    StatusBoxWallet,
    StatusBoxWalletEmbedded,
} from "./index";

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock pairing client store
let mockStoreState: {
    status: "idle" | "connecting" | "paired" | "retry-error";
    closeInfo?: { code?: number; reason?: string } | null;
} = {
    status: "idle",
    closeInfo: null,
};

const mockReconnect = vi.fn();

// Create a proper Zustand store mock
const createMockStore = () => ({
    getState: () => mockStoreState,
    subscribe: vi.fn((_listener: () => void) => {
        // Return unsubscribe function
        return () => {};
    }),
    setState: vi.fn(),
    destroy: vi.fn(),
});

const mockStore = createMockStore();

vi.mock("../../clients/store", () => ({
    getTargetPairingClient: vi.fn(() => ({
        store: mockStore,
        reconnect: mockReconnect,
    })),
}));

// Mock UI components
vi.mock("@frak-labs/ui/component/Button", () => ({
    Button: ({ children, onClick, className }: any) => (
        <button type="button" onClick={onClick} className={className}>
            {children}
        </button>
    ),
}));

vi.mock("@frak-labs/ui/component/Spinner", () => ({
    Spinner: () => <div data-testid="spinner">Loading</div>,
}));

describe("PairingStatusBox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState = {
            status: "idle",
            closeInfo: null,
        };
    });

    describe("StatusBoxWallet", () => {
        it("should render with status and title", () => {
            render(<StatusBoxWallet status="success" title="Paired" />);

            expect(screen.getByText("Paired")).toBeInTheDocument();
        });

        it("should render children", () => {
            render(
                <StatusBoxWallet status="success" title="Paired">
                    <div data-testid="child">Child content</div>
                </StatusBoxWallet>
            );

            expect(screen.getByTestId("child")).toBeInTheDocument();
        });

        it("should render with different statuses", () => {
            const { rerender } = render(
                <StatusBoxWallet status="success" title="Success" />
            );
            expect(screen.getByText("Success")).toBeInTheDocument();

            rerender(<StatusBoxWallet status="waiting" title="Waiting" />);
            expect(screen.getByText("Waiting")).toBeInTheDocument();

            rerender(<StatusBoxWallet status="loading" title="Loading" />);
            // Title is in a paragraph element
            const titleElement = screen.getByText("Loading", {
                selector: "p",
            });
            expect(titleElement).toBeInTheDocument();

            rerender(<StatusBoxWallet status="error" title="Error" />);
            expect(screen.getByText("Error")).toBeInTheDocument();
        });
    });

    describe("StatusBoxModal", () => {
        it("should render with status and title", () => {
            render(<StatusBoxModal status="success" title="Paired" />);

            expect(screen.getByText("Paired")).toBeInTheDocument();
        });

        it("should render children", () => {
            render(
                <StatusBoxModal status="success" title="Paired">
                    <div data-testid="child">Child content</div>
                </StatusBoxModal>
            );

            expect(screen.getByTestId("child")).toBeInTheDocument();
        });

        it("should render with different statuses", () => {
            const { rerender } = render(
                <StatusBoxModal status="success" title="Success" />
            );
            expect(screen.getByText("Success")).toBeInTheDocument();

            rerender(<StatusBoxModal status="error" title="Error" />);
            expect(screen.getByText("Error")).toBeInTheDocument();
        });
    });

    describe("StatusBoxWalletEmbedded", () => {
        it("should render with status and title", () => {
            render(<StatusBoxWalletEmbedded status="success" title="Paired" />);

            expect(screen.getByText("Paired")).toBeInTheDocument();
        });

        it("should render children", () => {
            render(
                <StatusBoxWalletEmbedded status="success" title="Paired">
                    <div data-testid="child">Child content</div>
                </StatusBoxWalletEmbedded>
            );

            expect(screen.getByTestId("child")).toBeInTheDocument();
        });

        it("should render with different statuses", () => {
            const { rerender } = render(
                <StatusBoxWalletEmbedded status="waiting" title="Waiting" />
            );
            expect(screen.getByText("Waiting")).toBeInTheDocument();

            rerender(
                <StatusBoxWalletEmbedded status="loading" title="Loading" />
            );
            // Title is in a paragraph element
            const titleElement = screen.getByText("Loading", {
                selector: "p",
            });
            expect(titleElement).toBeInTheDocument();
        });
    });

    describe("StatusBoxRetry", () => {
        it("should not render when status is not retry-error", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: null,
            };
            // Change to non-retry-error status
            mockStoreState.status = "idle";

            render(<StatusBoxWallet status="waiting" title="Idle" />);

            expect(
                screen.queryByText("wallet.pairing.refresh")
            ).not.toBeInTheDocument();
        });

        it("should render retry button when status is retry-error", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: null,
            };

            render(<StatusBoxWallet status="error" title="Error" />);

            expect(
                screen.getByText("wallet.pairing.refresh")
            ).toBeInTheDocument();
        });

        it("should call reconnect when retry button is clicked", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: null,
            };

            render(<StatusBoxWallet status="error" title="Error" />);

            const retryButton = screen.getByText("wallet.pairing.refresh");
            fireEvent.click(retryButton);

            expect(mockReconnect).toHaveBeenCalledTimes(1);
        });

        it("should display close code when available", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: {
                    code: 1000,
                    reason: undefined,
                },
            };

            render(<StatusBoxWallet status="error" title="Error" />);

            expect(
                screen.getByText(/wallet.pairing.refreshCode.*1000/)
            ).toBeInTheDocument();
        });

        it("should display close reason when available", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: {
                    code: undefined,
                    reason: "Connection lost",
                },
            };

            render(<StatusBoxWallet status="error" title="Error" />);

            expect(
                screen.getByText(
                    /wallet.pairing.refreshReason.*Connection lost/
                )
            ).toBeInTheDocument();
        });

        it("should display both code and reason when available", () => {
            mockStoreState = {
                status: "retry-error",
                closeInfo: {
                    code: 1001,
                    reason: "Network error",
                },
            };

            render(<StatusBoxWallet status="error" title="Error" />);

            expect(
                screen.getByText(/wallet.pairing.refreshCode.*1001/)
            ).toBeInTheDocument();
            expect(
                screen.getByText(/wallet.pairing.refreshReason.*Network error/)
            ).toBeInTheDocument();
        });
    });

    describe("status icons", () => {
        it("should render spinner for loading status", () => {
            render(<StatusBoxWallet status="loading" title="Loading" />);

            expect(screen.getByTestId("spinner")).toBeInTheDocument();
        });

        it("should render indicator for success status", () => {
            const { container } = render(
                <StatusBoxWallet status="success" title="Success" />
            );

            const indicator = container.querySelector(
                '[class*="statusBox__indicator--green"]'
            );
            expect(indicator).toBeInTheDocument();
        });

        it("should render indicator for waiting status", () => {
            const { container } = render(
                <StatusBoxWallet status="waiting" title="Waiting" />
            );

            const indicator = container.querySelector(
                '[class*="statusBox__indicator--amber"]'
            );
            expect(indicator).toBeInTheDocument();
        });

        it("should render indicator for error status", () => {
            const { container } = render(
                <StatusBoxWallet status="error" title="Error" />
            );

            const indicator = container.querySelector(
                '[class*="statusBox__indicator--red"]'
            );
            expect(indicator).toBeInTheDocument();
        });
    });

    describe("edge cases", () => {
        it("should handle all three variants with same props", () => {
            const { rerender } = render(
                <StatusBoxWallet status="success" title="Test" />
            );
            expect(screen.getByText("Test")).toBeInTheDocument();

            rerender(<StatusBoxModal status="success" title="Test" />);
            expect(screen.getByText("Test")).toBeInTheDocument();

            rerender(<StatusBoxWalletEmbedded status="success" title="Test" />);
            expect(screen.getByText("Test")).toBeInTheDocument();
        });

        it("should handle empty title", () => {
            const { container } = render(
                <StatusBoxWallet status="success" title="" />
            );

            // Title element should exist even if empty
            const titleElement = container.querySelector(
                '[class*="statusBox__title"]'
            );
            expect(titleElement).toBeInTheDocument();
        });
    });
});

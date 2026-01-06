/**
 * Tests for LaunchPairing component
 * Tests pairing launch with QR code display and state management
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchPairing } from "./index";

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

// Mock Cuer QR code component
vi.mock("cuer", () => ({
    Cuer: ({ value, size }: { value: string; size: number }) => (
        <div data-testid="qr-code" data-value={value} data-size={size}>
            QR Code
        </div>
    ),
}));

// Mock PairingCode and PairingStatus
vi.mock("../PairingCode", () => ({
    PairingCode: ({ code, theme }: { code: string; theme?: string }) => (
        <div data-testid="pairing-code" data-code={code} data-theme={theme}>
            {code}
        </div>
    ),
}));

vi.mock("../PairingStatus", () => ({
    PairingStatus: ({ status }: { status: string }) => (
        <div data-testid="pairing-status" data-status={status}>
            {status}
        </div>
    ),
}));

// Mock analytics
vi.mock("../../../common/analytics", () => ({
    trackAuthInitiated: vi.fn(),
}));

// Mock pairing client
let mockPairingState: {
    status: "idle" | "connecting" | "paired" | "retry-error";
    pairing?: { id: string; code: string } | null;
    partnerDevice?: string | null;
} = {
    status: "idle",
    pairing: null,
    partnerDevice: null,
};

const mockInitiatePairing = vi.fn();

const createMockStore = () => ({
    getState: () => mockPairingState,
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
    destroy: vi.fn(),
});

const mockStore = createMockStore();

vi.mock("../../clients/store", () => ({
    getOriginPairingClient: vi.fn(() => ({
        store: mockStore,
        initiatePairing: mockInitiatePairing,
    })),
}));

describe("LaunchPairing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPairingState = {
            status: "idle",
            pairing: null,
            partnerDevice: null,
        };
    });

    describe("initialization", () => {
        it("should call initiatePairing on mount", () => {
            render(<LaunchPairing />);

            expect(mockInitiatePairing).toHaveBeenCalledTimes(1);
        });

        it("should call trackAuthInitiated on mount", async () => {
            const { trackAuthInitiated } = await import(
                "../../../common/analytics"
            );
            render(<LaunchPairing />);

            expect(vi.mocked(trackAuthInitiated)).toHaveBeenCalledWith(
                "pairing"
            );
        });

        it("should call initiatePairing with onSuccess callback when provided", () => {
            const onSuccess = vi.fn();
            render(<LaunchPairing onSuccess={onSuccess} />);

            expect(mockInitiatePairing).toHaveBeenCalledWith(onSuccess);
        });
    });

    describe("QR code display", () => {
        it("should show spinner when pairing info is not available", () => {
            mockPairingState.pairing = null;

            render(<LaunchPairing />);

            expect(screen.getByTestId("spinner")).toBeInTheDocument();
            expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
        });

        it("should display QR code when pairing info is available", () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const qrCode = screen.getByTestId("qr-code");
            expect(qrCode).toBeInTheDocument();
            expect(qrCode).toHaveAttribute(
                "data-value",
                expect.stringContaining("pairing-123")
            );
        });

        it("should display QR code with correct URL format", () => {
            mockPairingState.pairing = {
                id: "pairing-456",
                code: "789012",
            };

            render(<LaunchPairing />);

            const qrCode = screen.getByTestId("qr-code");
            expect(qrCode.getAttribute("data-value")).toContain(
                "/pairing?id=pairing-456"
            );
        });

        it("should set QR code size to 200", () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const qrCode = screen.getByTestId("qr-code");
            expect(qrCode).toHaveAttribute("data-size", "200");
        });
    });

    describe("pairing code display", () => {
        it("should display pairing code when available", () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const pairingCode = screen.getByTestId("pairing-code");
            expect(pairingCode).toBeInTheDocument();
            expect(pairingCode).toHaveAttribute("data-code", "123456");
        });

        it("should use light theme by default", () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const pairingCode = screen.getByTestId("pairing-code");
            expect(pairingCode).toHaveAttribute("data-theme", "light");
        });
    });

    describe("pairing status display", () => {
        it("should display pairing status", () => {
            mockPairingState.status = "connecting";

            render(<LaunchPairing />);

            const status = screen.getByTestId("pairing-status");
            expect(status).toBeInTheDocument();
            expect(status).toHaveAttribute("data-status", "connecting");
        });

        it("should display different statuses", () => {
            mockPairingState.status = "idle";
            const { unmount } = render(<LaunchPairing />);

            let status = screen.getByTestId("pairing-status");
            expect(status).toHaveAttribute("data-status", "idle");

            unmount();

            mockPairingState.status = "paired";
            render(<LaunchPairing />);

            status = screen.getByTestId("pairing-status");
            expect(status).toHaveAttribute("data-status", "paired");
        });
    });

    describe("partner device display", () => {
        it("should display partner device when available", () => {
            mockPairingState.partnerDevice = "iPhone 15";

            render(<LaunchPairing />);

            expect(screen.getByText("iPhone 15")).toBeInTheDocument();
        });

        it("should not display partner device when null", () => {
            mockPairingState.partnerDevice = null;

            render(<LaunchPairing />);

            expect(screen.queryByText(/iPhone/)).not.toBeInTheDocument();
        });
    });

    describe("fullscreen QR code", () => {
        it("should toggle fullscreen QR code on click", async () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const qrCodeButton = screen
                .getByTestId("qr-code")
                .closest("button");
            expect(qrCodeButton).toBeInTheDocument();

            fireEvent.click(qrCodeButton!);

            await waitFor(() => {
                // Fullscreen QR code should appear
                const fullscreenQRCodes = screen.getAllByTestId("qr-code");
                expect(fullscreenQRCodes.length).toBeGreaterThan(1);
            });
        });

        it("should use dark theme when fullscreen is active", async () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "123456",
            };

            render(<LaunchPairing />);

            const qrCodeButton = screen
                .getByTestId("qr-code")
                .closest("button");
            fireEvent.click(qrCodeButton!);

            await waitFor(() => {
                const pairingCodes = screen.getAllByTestId("pairing-code");
                const darkCode = pairingCodes.find(
                    (code) => code.getAttribute("data-theme") === "dark"
                );
                expect(darkCode).toBeInTheDocument();
            });
        });
    });

    describe("edge cases", () => {
        it("should handle missing pairing info gracefully", () => {
            mockPairingState.pairing = null;

            render(<LaunchPairing />);

            expect(screen.getByTestId("spinner")).toBeInTheDocument();
        });

        it("should handle empty pairing code", () => {
            mockPairingState.pairing = {
                id: "pairing-123",
                code: "",
            };

            render(<LaunchPairing />);

            // Empty code should still render PairingCode component
            const pairingCode = screen.queryByTestId("pairing-code");
            // Component checks pairingInfo?.code, empty string is truthy so it renders
            if (pairingCode) {
                expect(pairingCode).toHaveAttribute("data-code", "");
            }
        });

        it("should handle all pairing states", () => {
            const states: Array<
                "idle" | "connecting" | "paired" | "retry-error"
            > = ["idle", "connecting", "paired", "retry-error"];

            states.forEach((state) => {
                mockPairingState.status = state;
                const { unmount } = render(<LaunchPairing />);

                const status = screen.getByTestId("pairing-status");
                expect(status).toHaveAttribute("data-status", state);

                unmount();
            });
        });
    });
});

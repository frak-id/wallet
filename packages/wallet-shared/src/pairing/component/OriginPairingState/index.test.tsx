/**
 * Tests for OriginPairingState component
 * Tests origin pairing state display with Zustand store integration
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OriginPairingState } from "./index";

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock sessionStore
let mockSessionState: {
    distantWebauthnSession: null | { address: `0x${string}` };
} = {
    distantWebauthnSession: null,
};

vi.mock("../../../stores/sessionStore", () => ({
    sessionStore: vi.fn((selector: any) => {
        if (typeof selector === "function") {
            return selector(mockSessionState);
        }
        return mockSessionState;
    }),
    selectDistantWebauthnSession: vi.fn(
        (state: typeof mockSessionState) => state.distantWebauthnSession
    ),
}));

// Mock pairing client store
let mockPairingState: {
    status: "idle" | "connecting" | "paired" | "retry-error";
    signatureRequests: Map<string, unknown>;
} = {
    status: "idle",
    signatureRequests: new Map(),
};

const createMockStore = () => ({
    getState: () => mockPairingState,
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
    destroy: vi.fn(),
});

const mockStore = createMockStore();

// Mock PairingStatusBox components to avoid needing to mock getTargetPairingClient
vi.mock("../PairingStatusBox", () => ({
    StatusBoxWallet: ({ status, title }: any) => (
        <div data-testid="status-box-wallet" data-status={status}>
            {title}
        </div>
    ),
    StatusBoxModal: ({ status, title }: any) => (
        <div data-testid="status-box-modal" data-status={status}>
            {title}
        </div>
    ),
    StatusBoxWalletEmbedded: ({ status, title }: any) => (
        <div data-testid="status-box-embedded" data-status={status}>
            {title}
        </div>
    ),
}));

vi.mock("../../clients/store", () => ({
    getOriginPairingClient: vi.fn(() => ({
        store: mockStore,
    })),
}));

describe("OriginPairingState", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSessionState = {
            distantWebauthnSession: null,
        };
        mockPairingState = {
            status: "idle",
            signatureRequests: new Map(),
        };
    });

    describe("conditional rendering", () => {
        it("should return null when no distant webauthn session", () => {
            mockSessionState.distantWebauthnSession = null;

            const { container } = render(<OriginPairingState type="wallet" />);

            expect(container.firstChild).toBeNull();
        });

        it("should render when distant webauthn session exists", () => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };

            render(<OriginPairingState type="wallet" />);

            // Should render status box
            expect(screen.getByTestId("status-box-wallet")).toBeInTheDocument();
        });
    });

    describe("component variants", () => {
        beforeEach(() => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };
        });

        it("should render wallet variant", () => {
            render(<OriginPairingState type="wallet" />);

            expect(screen.getByTestId("status-box-wallet")).toBeInTheDocument();
        });

        it("should render modal variant", () => {
            render(<OriginPairingState type="modal" />);

            expect(screen.getByTestId("status-box-modal")).toBeInTheDocument();
        });

        it("should render embedded variant", () => {
            render(<OriginPairingState type="embedded" />);

            expect(
                screen.getByTestId("status-box-embedded")
            ).toBeInTheDocument();
        });

        it("should throw error for invalid type", () => {
            // @ts-expect-error - Testing invalid type
            expect(() => render(<OriginPairingState type="invalid" />)).toThrow(
                "Invalid type: invalid"
            );
        });
    });

    describe("status display", () => {
        beforeEach(() => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };
        });

        it("should display idle status", () => {
            mockPairingState.status = "idle";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.idle"
            );
        });

        it("should display connecting status", () => {
            mockPairingState.status = "connecting";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.connecting"
            );
        });

        it("should display paired status", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "success");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.paired"
            );
        });

        it("should display retry-error status", () => {
            mockPairingState.status = "retry-error";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "error");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.retryError"
            );
        });
    });

    describe("signature request states", () => {
        beforeEach(() => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };
        });

        it("should display paired state when signature requests exist and paired", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map([["req-1", {}]]);

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "loading");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.requests.paired"
            );
        });

        it("should display connecting state when signature requests exist and connecting", () => {
            mockPairingState.status = "connecting";
            mockPairingState.signatureRequests = new Map([["req-1", {}]]);

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.requests.connecting"
            );
        });

        it("should prioritize signature request state over regular state", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map([["req-1", {}]]);

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            // Should show request state, not regular paired state
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.requests.paired"
            );
            expect(statusBox).not.toHaveTextContent(
                "wallet.pairing.origin.state.paired"
            );
        });
    });

    describe("status indicators", () => {
        beforeEach(() => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };
        });

        it("should show success status for paired status", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "success");
        });

        it("should show waiting status for idle status", () => {
            mockPairingState.status = "idle";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
        });

        it("should show error status for retry-error status", () => {
            mockPairingState.status = "retry-error";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="wallet" />);

            const statusBox = screen.getByTestId("status-box-wallet");
            expect(statusBox).toHaveAttribute("data-status", "error");
        });
    });
});

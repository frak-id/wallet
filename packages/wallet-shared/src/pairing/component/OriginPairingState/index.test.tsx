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

vi.mock("../../../stores/sessionStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        sessionStore: createStore<any>(() => ({
            distantWebauthnSession: null,
        })),
        selectDistantWebauthnSession: vi.fn(
            (state: any) => state.distantWebauthnSession
        ),
    };
});

// Mock pairing client store
type PairingState = {
    status: "idle" | "connecting" | "paired" | "retry-error" | "error";
    signatureRequests: Map<string, unknown>;
};

// Mock PairingStatusBox components to avoid needing to mock getTargetPairingClient
vi.mock("../PairingStatusBox", () => ({
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

vi.mock("../../clients/store", async () => {
    const { createStore } = await import("zustand/vanilla");
    const pairingStore = createStore<PairingState>(() => ({
        status: "idle",
        signatureRequests: new Map(),
    }));
    return {
        getOriginPairingClient: vi.fn(() => ({ store: pairingStore })),
    };
});

describe("OriginPairingState", () => {
    let mockSessionState: { distantWebauthnSession: any };
    let mockPairingState: PairingState;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { sessionStore } = await import("../../../stores/sessionStore");
        sessionStore.setState({ distantWebauthnSession: null }, true);
        mockSessionState = new Proxy({} as any, {
            get: (_, key: string) => (sessionStore.getState() as any)[key],
            set: (_, key: string, value) => {
                sessionStore.setState({ [key]: value });
                return true;
            },
        });

        const { getOriginPairingClient } = await import("../../clients/store");
        const pairingStore = (getOriginPairingClient() as any)
            .store as import("zustand/vanilla").StoreApi<PairingState>;
        pairingStore.setState(
            { status: "idle", signatureRequests: new Map() },
            true
        );
        mockPairingState = new Proxy({} as any, {
            get: (_, key: string) => (pairingStore.getState() as any)[key],
            set: (_, key: string, value) => {
                pairingStore.setState({ [key]: value });
                return true;
            },
        });
    });

    describe("conditional rendering", () => {
        it("should return null when no distant webauthn session", () => {
            mockSessionState.distantWebauthnSession = null;

            const { container } = render(<OriginPairingState type="modal" />);

            expect(container.firstChild).toBeNull();
        });

        it("should render when distant webauthn session exists", () => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };

            render(<OriginPairingState type="modal" />);

            // Should render status box
            expect(screen.getByTestId("status-box-modal")).toBeInTheDocument();
        });
    });

    describe("component variants", () => {
        beforeEach(() => {
            mockSessionState.distantWebauthnSession = {
                address: "0x1234567890123456789012345678901234567890",
            };
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

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.idle"
            );
        });

        it("should display connecting status", () => {
            mockPairingState.status = "connecting";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.connecting"
            );
        });

        it("should display paired status", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "success");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.paired"
            );
        });

        it("should display retry-error status", () => {
            mockPairingState.status = "retry-error";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
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

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "loading");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.requests.paired"
            );
        });

        it("should display connecting state when signature requests exist and connecting", () => {
            mockPairingState.status = "connecting";
            mockPairingState.signatureRequests = new Map([["req-1", {}]]);

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
            expect(statusBox).toHaveTextContent(
                "wallet.pairing.origin.state.requests.connecting"
            );
        });

        it("should prioritize signature request state over regular state", () => {
            mockPairingState.status = "paired";
            mockPairingState.signatureRequests = new Map([["req-1", {}]]);

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
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

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "success");
        });

        it("should show waiting status for idle status", () => {
            mockPairingState.status = "idle";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "waiting");
        });

        it("should show error status for retry-error status", () => {
            mockPairingState.status = "retry-error";
            mockPairingState.signatureRequests = new Map();

            render(<OriginPairingState type="modal" />);

            const statusBox = screen.getByTestId("status-box-modal");
            expect(statusBox).toHaveAttribute("data-status", "error");
        });
    });
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRestricted } from "./index";

const mockNavigate = vi.fn();
const mockSelectSession = vi.fn();
const mockSessionStore = vi.fn();
const mockGetSafeSession = vi.fn();
const mockUsePendingPairingInfo = vi.fn();

vi.mock("react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    selectSession: () => mockSelectSession(),
    sessionStore: (selector: any) => mockSessionStore(selector),
    getSafeSession: () => mockGetSafeSession(),
}));

vi.mock("@/module/pairing/hook/usePendingPairingInfo", () => ({
    usePendingPairingInfo: () => mockUsePendingPairingInfo(),
}));

vi.mock("@frak-labs/ui/component/Skeleton", () => ({
    Skeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

describe("AuthRestricted", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePendingPairingInfo.mockReturnValue({ pairingInfo: null });
        mockSessionStore.mockImplementation((selector) => {
            if (selector === mockSelectSession) {
                return mockSelectSession();
            }
            return undefined;
        });
    });

    it("should render children when authenticated and requireAuthenticated is true", async () => {
        mockSelectSession.mockReturnValue({ token: "test-token" });
        mockGetSafeSession.mockReturnValue({ token: "test-token" });

        render(
            <AuthRestricted requireAuthenticated={true}>
                <div>Protected Content</div>
            </AuthRestricted>
        );

        await waitFor(() => {
            expect(screen.getByText("Protected Content")).toBeInTheDocument();
        });
    });

    it("should redirect to register when not authenticated and requireAuthenticated is true", async () => {
        mockSelectSession.mockReturnValue(null);
        mockGetSafeSession.mockReturnValue(null);

        render(
            <AuthRestricted requireAuthenticated={true}>
                <div>Protected Content</div>
            </AuthRestricted>
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/register", {
                replace: true,
            });
        });
    });

    it("should redirect to wallet when authenticated and requireAuthenticated is false", async () => {
        mockSelectSession.mockReturnValue({ token: "test-token" });
        mockGetSafeSession.mockReturnValue({ token: "test-token" });

        render(
            <AuthRestricted requireAuthenticated={false}>
                <div>Public Content</div>
            </AuthRestricted>
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/wallet", {
                replace: true,
            });
        });
    });

    it("should redirect to pairing when authenticated, requireAuthenticated is false, and pairingInfo exists", async () => {
        mockSelectSession.mockReturnValue({ token: "test-token" });
        mockGetSafeSession.mockReturnValue({ token: "test-token" });
        mockUsePendingPairingInfo.mockReturnValue({
            pairingInfo: { id: "pairing-123" },
        });

        render(
            <AuthRestricted requireAuthenticated={false}>
                <div>Public Content</div>
            </AuthRestricted>
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/pairing", {
                replace: true,
            });
        });
    });

    it("should render children when not authenticated and requireAuthenticated is false", async () => {
        mockSelectSession.mockReturnValue(null);
        mockGetSafeSession.mockReturnValue(null);

        render(
            <AuthRestricted requireAuthenticated={false}>
                <div>Public Content</div>
            </AuthRestricted>
        );

        await waitFor(() => {
            expect(screen.getByText("Public Content")).toBeInTheDocument();
        });
    });

    it("should render skeleton while determining access", () => {
        mockSelectSession.mockReturnValue(null);
        mockGetSafeSession.mockReturnValue(null);

        render(
            <AuthRestricted requireAuthenticated={true}>
                <div>Protected Content</div>
            </AuthRestricted>
        );

        // Initially shows skeleton before redirect
        expect(screen.queryByTestId("skeleton")).toBeInTheDocument();
    });
});

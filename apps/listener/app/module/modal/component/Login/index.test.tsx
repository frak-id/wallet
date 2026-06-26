import type { LoginModalStepType } from "@frak-labs/core-sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import type { StoreApi, UseBoundStore } from "zustand";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { LoginModalStep } from "./index";

// Mutable login-hook state, flipped per test (hoisted so the vi.mock factory
// can read it).
const loginMock = vi.hoisted(() => vi.fn());
const loginState = vi.hoisted(() => ({
    isSuccess: false,
    isLoading: false,
    error: null as Error | null,
}));

vi.mock("@frak-labs/wallet-shared/authentication", () => ({
    useWebauthnErrorToast: () => {},
}));

vi.mock("@frak-labs/wallet-shared/authentication/hook/useLogin", () => ({
    useLogin: () => ({
        login: loginMock,
        isSuccess: loginState.isSuccess,
        isLoading: loginState.isLoading,
        error: loginState.error,
    }),
}));

vi.mock("@frak-labs/wallet-shared/common", () => ({
    isWebAuthNSupported: true,
    prefixModalCss: (name: string) => `nexus-modal-${name}`,
}));

// Expose `mockSessionStore` so individual tests can seed or update the
// session (e.g. simulate dead-token re-login or SSO completion).
type MockSessionState = {
    session: { address: string; authenticatorId?: string } | null;
    setSession: (
        s: { address: string; authenticatorId?: string } | null
    ) => void;
};
const mockSessionStore = vi.hoisted(() => ({
    store: null as UseBoundStore<StoreApi<MockSessionState>> | null,
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", async () => {
    const { create } = await import("zustand");
    const sessionStore = create<MockSessionState>((set) => ({
        session: null,
        setSession: (session) => set({ session }),
    }));
    mockSessionStore.store = sessionStore;
    return {
        sessionStore,
        selectSession: (s: {
            session: { address: string; authenticatorId?: string } | null;
        }) => s.session,
    };
});

vi.mock("@/module/stores/resolvingContextStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    const resolvingContextStore = createStore(() => ({
        context: { merchantId: "0xabc" },
    }));
    return { resolvingContextStore };
});

vi.mock("@/ui/ListenerUiProvider", () => ({
    useListenerTranslation: () => ({ t: (key: string) => key }),
    useModalListenerUI: () => ({
        currentRequest: {
            homepageLink: "https://merchant.example",
            logoUrl: "https://merchant.example/logo.png",
        },
    }),
}));

vi.mock("@/module/component/SsoButton", () => ({
    SsoButton: ({ text }: { text: ReactNode }) => (
        <div data-testid="sso-button">{text}</div>
    ),
}));

vi.mock("@/module/modal/component/Generic", () => ({
    DismissButton: () => <div data-testid="dismiss-button" />,
}));

vi.mock("../AuthenticateWithPhone", () => ({
    AuthenticateWithPhone: ({ text }: { text: ReactNode }) => (
        <div data-testid="phone-button">{text}</div>
    ),
}));

function getSessionStore() {
    if (!mockSessionStore.store) {
        throw new Error("mock sessionStore not initialised");
    }
    return mockSessionStore.store;
}

function renderLogin(
    params: Partial<LoginModalStepType["params"]> = {},
    onFinish = vi.fn()
) {
    return {
        onFinish,
        ...render(
            <LoginModalStep
                params={params as LoginModalStepType["params"]}
                onFinish={onFinish}
            />
        ),
    };
}

describe("LoginModalStep", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginState.isSuccess = false;
        loginState.isLoading = false;
        loginState.error = null;
        // Reset session to null before each test.
        act(() => {
            getSessionStore().setState({ session: null });
        });
    });

    test("shows SSO + QR options and no passkey fallback when SSO is allowed", () => {
        renderLogin({ allowSso: true });

        expect(screen.getByTestId("sso-button")).toBeInTheDocument();
        expect(screen.getByTestId("phone-button")).toBeInTheDocument();
        expect(screen.getByTestId("dismiss-button")).toBeInTheDocument();
        // The webauthn fallback <button> is only rendered when SSO is disabled.
        expect(screen.queryByRole("button")).toBeNull();
    });

    test("renders the passkey fallback and logs in on click when SSO is disabled (first login — no session)", () => {
        renderLogin({ allowSso: false });

        // SSO button is gone; the QR option stays.
        expect(screen.queryByTestId("sso-button")).toBeNull();
        expect(screen.getByTestId("phone-button")).toBeInTheDocument();

        const passkeyButton = screen.getByRole("button", {
            name: "sdk.modal.login.primaryAction",
        });
        fireEvent.click(passkeyButton);

        // No session → global (unscoped) login.
        expect(loginMock).toHaveBeenCalledWith({});
    });

    test("scopes passkey login to the current authenticator on re-login (dead token)", () => {
        // Seed a stale session so the store looks like a dead-token re-login.
        act(() => {
            getSessionStore().setState({
                session: { address: "0xdead", authenticatorId: "cred-abc" },
            });
        });

        renderLogin({ allowSso: false });

        const passkeyButton = screen.getByRole("button", {
            name: "sdk.modal.login.primaryAction",
        });
        fireEvent.click(passkeyButton);

        // Re-login → scoped to the stale session's authenticatorId.
        expect(loginMock).toHaveBeenCalledWith({
            allowedCredentialIds: ["cred-abc"],
        });
    });

    test("does NOT auto-finish on mount when a stale (dead-token) session is already in the store", () => {
        // Seed a stale session before rendering — this simulates the dead-token
        // re-login path where filterStepsToDo re-shows the login step but the
        // session object is still in localStorage / sessionStore.
        act(() => {
            getSessionStore().setState({
                session: { address: "0xstale", authenticatorId: "cred-xyz" },
            });
        });

        const { onFinish } = renderLogin({ allowSso: true });

        // The stale session must NOT bypass the re-login step.
        expect(onFinish).not.toHaveBeenCalled();
    });

    test("auto-finishes when a NEW session arrives after mount (SSO / phone pairing completion)", () => {
        const { onFinish } = renderLogin({ allowSso: true });

        // Session is null on mount; now SSO delivers a fresh session.
        act(() => {
            getSessionStore().setState({
                session: { address: "0xfresh" },
            });
        });

        expect(onFinish).toHaveBeenCalledWith({
            wallet: "0xfresh",
            webauthnProof: undefined,
        });
    });

    test("shows the success message once login succeeds", () => {
        loginState.isSuccess = true;
        renderLogin({ allowSso: true });

        expect(screen.getByText("sdk.modal.login.success")).toBeInTheDocument();
    });
});

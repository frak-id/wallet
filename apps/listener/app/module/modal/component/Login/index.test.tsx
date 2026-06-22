import type { LoginModalStepType } from "@frak-labs/core-sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
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

vi.mock("@frak-labs/wallet-shared/stores/authenticationStore", () => ({
    authenticationStore: {
        getState: () => ({ lastWebAuthNAction: null }),
    },
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", async () => {
    const { create } = await import("zustand");
    const sessionStore = create(() => ({
        session: null as { address: string } | null,
    }));
    return {
        sessionStore,
        selectSession: (s: { session: unknown }) => s.session,
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

function renderLogin(params: Partial<LoginModalStepType["params"]> = {}) {
    return render(
        <LoginModalStep
            params={params as LoginModalStepType["params"]}
            onFinish={vi.fn()}
        />
    );
}

describe("LoginModalStep", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginState.isSuccess = false;
        loginState.isLoading = false;
        loginState.error = null;
    });

    test("shows SSO + QR options and no passkey fallback when SSO is allowed", () => {
        renderLogin({ allowSso: true });

        expect(screen.getByTestId("sso-button")).toBeInTheDocument();
        expect(screen.getByTestId("phone-button")).toBeInTheDocument();
        expect(screen.getByTestId("dismiss-button")).toBeInTheDocument();
        // The webauthn fallback <button> is only rendered when SSO is disabled.
        expect(screen.queryByRole("button")).toBeNull();
    });

    test("renders the passkey fallback and logs in on click when SSO is disabled", () => {
        renderLogin({ allowSso: false });

        // SSO button is gone; the QR option stays.
        expect(screen.queryByTestId("sso-button")).toBeNull();
        expect(screen.getByTestId("phone-button")).toBeInTheDocument();

        const passkeyButton = screen.getByRole("button", {
            name: "sdk.modal.login.secondaryAction",
        });
        fireEvent.click(passkeyButton);

        expect(loginMock).toHaveBeenCalledWith({});
    });

    test("shows the success message once login succeeds", () => {
        loginState.isSuccess = true;
        renderLogin({ allowSso: true });

        expect(screen.getByText("sdk.modal.login.success")).toBeInTheDocument();
    });
});

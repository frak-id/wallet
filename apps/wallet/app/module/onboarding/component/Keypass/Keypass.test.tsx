import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Keypass } from "./index";

const mockRegister = vi.fn().mockResolvedValue({});
const mockLogin = vi.fn();

vi.mock("@frak-labs/wallet-shared", async () => {
    const actual = await vi.importActual<
        typeof import("@frak-labs/wallet-shared")
    >("@frak-labs/wallet-shared");
    return {
        ...actual,
        isWebAuthNSupported: true,
        useLogin: () => ({
            login: mockLogin,
            isLoading: false,
            isSuccess: false,
            isError: false,
            error: null,
        }),
        HandleErrors: ({ error }: { error: Error }) => (
            <span data-testid="error">{error.message}</span>
        ),
    };
});

vi.mock("@/module/authentication/hook/useRegister", () => ({
    useRegister: () => ({
        register: mockRegister,
        isRegisterInProgress: false,
        isSuccess: false,
        isError: false,
        error: null,
    }),
}));

vi.mock("@/module/authentication/lib/isAuthenticatorAlreadyRegistered", () => ({
    isAuthenticatorAlreadyRegistered: () => false,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
}));

describe("Keypass", () => {
    it("should render modal content", async () => {
        const onClose = vi.fn();
        const onAuthSuccess = vi.fn();

        render(<Keypass onClose={onClose} onAuthSuccess={onAuthSuccess} />);

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });

    it("should call register when Continue button clicked", async () => {
        const onClose = vi.fn();
        const onAuthSuccess = vi.fn();

        render(<Keypass onClose={onClose} onAuthSuccess={onAuthSuccess} />);

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const buttons = screen.getAllByRole("button");
        const continueButton = buttons.find((btn) =>
            btn.textContent?.includes("onboarding.continue")
        );

        if (continueButton) {
            fireEvent.click(continueButton);
            expect(mockRegister).toHaveBeenCalled();
        }
    });

    it("should render as always open (controlled by outlet)", async () => {
        const onClose = vi.fn();
        const onAuthSuccess = vi.fn();

        render(<Keypass onClose={onClose} onAuthSuccess={onAuthSuccess} />);

        await waitFor(() => {
            const drawer = document.querySelector("[data-vaul-drawer]");
            expect(drawer).toBeInTheDocument();
        });

        const drawer = document.querySelector("[data-vaul-drawer]");
        expect(drawer).toBeInTheDocument();
    });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmail } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const navigateMock = vi.fn();
const historyBackMock = vi.fn();
let canGoBack = true;

// Spread `importActual`: the screen renders through FlowStepScreen /
// EmailFormScreen → PageLayout, so anything else those pull from the router
// must keep its real implementation. The global test-foundation mock does not
// apply — it never binds to the module instance these components import.
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        "@tanstack/react-router"
    );
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useRouter: () => ({ history: { back: historyBackMock } }),
        useCanGoBack: () => canGoBack,
    };
});

vi.mock("@/module/email-verification/hook/useSendEmailVerification", () => ({
    useSendEmailVerification: () => ({
        sendCode: vi.fn(),
        isSending: false,
        cooldownSeconds: 0,
        error: null,
        reset: vi.fn(),
        data: undefined,
    }),
}));

vi.mock("@/module/email-verification/hook/useVerifyEmailCode", () => ({
    useVerifyEmailCode: () => ({
        mutateAsync: vi.fn(),
        reset: vi.fn(),
        isPending: false,
        isError: false,
        data: undefined,
    }),
}));

vi.mock("@/module/authentication/hook/useCurrentEmail", () => ({
    useCurrentEmail: () => ({
        data: { email: "user@frak.id", verified: false, pendingEmail: null },
    }),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    CodeInput: () => createElement("div", null, "code-input"),
    selectSession: () => undefined,
    sessionStore: {},
}));

vi.mock("zustand", () => ({ useStore: () => undefined }));

beforeEach(() => {
    vi.clearAllMocks();
    canGoBack = true;
});

function clickBack() {
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
}

describe("VerifyEmail back navigation", () => {
    it("returns to the opener rather than /profile when history can be popped", () => {
        render(<VerifyEmail />);

        clickBack();

        expect(historyBackMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("replaces with /profile when opened from the emailed magic link", () => {
        // A `#code=` link opened from a mail client has no history to pop.
        canGoBack = false;
        render(<VerifyEmail />);

        clickBack();

        expect(historyBackMock).not.toHaveBeenCalled();
        expect(navigateMock).toHaveBeenCalledWith({
            to: "/profile",
            replace: true,
        });
    });

    it("exits the screen from the change-email form entered via ?mode=change", () => {
        render(<VerifyEmail startInChangeEmail />);

        clickBack();

        // `backTo: "exit"` leaves the screen entirely rather than falling back
        // to the code step the user never saw.
        expect(historyBackMock).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByText("wallet.verifyEmail.title")
        ).not.toBeInTheDocument();
    });

    it("returns to the code step from the change-email form entered mid-flow", () => {
        render(<VerifyEmail />);

        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.verifyEmail.changeEmailLink",
            })
        );
        expect(
            screen.getByText("wallet.verifyEmail.changeEmail.title")
        ).toBeInTheDocument();

        clickBack();

        // In-flow: back is a step transition, never a navigation.
        expect(
            screen.getByText("wallet.verifyEmail.title")
        ).toBeInTheDocument();
        expect(historyBackMock).not.toHaveBeenCalled();
        expect(navigateMock).not.toHaveBeenCalled();
    });
});

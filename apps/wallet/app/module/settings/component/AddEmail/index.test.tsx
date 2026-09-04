import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddEmail } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const navigateMock = vi.fn();
const historyBackMock = vi.fn();
let canGoBack = true;

// Spread `importActual` rather than returning a bare three-export object: the
// screen renders through EmailFormScreen → PageLayout, so anything those pull
// from the router (Link, useRouterState, …) must keep its real implementation.
// The global mock in test-foundation does not apply here — it never binds to
// the module instance these components import.
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

const sendCodeMock = vi.fn();

vi.mock("@/module/email-verification/hook/useSendEmailVerification", () => ({
    useSendEmailVerification: () => ({
        sendCode: sendCodeMock,
        isSending: false,
        error: null,
        reset: vi.fn(),
    }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    authKey: { myEmail: ["myEmail"] },
    selectSession: () => undefined,
    sessionStore: {},
}));

vi.mock("zustand", () => ({ useStore: () => undefined }));

beforeEach(() => {
    vi.clearAllMocks();
    canGoBack = true;
    sendCodeMock.mockResolvedValue({ status: "sent" });
});

function clickBack() {
    fireEvent.click(screen.getByRole("button", { name: "common.back" }));
}

describe("AddEmail back navigation", () => {
    it("returns to the opener instead of /profile when history can be popped", () => {
        render(<AddEmail />);

        clickBack();

        expect(historyBackMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("replaces with /profile when there is no history to pop", () => {
        canGoBack = false;
        render(<AddEmail />);

        clickBack();

        expect(historyBackMock).not.toHaveBeenCalled();
        // `replace` is load-bearing: without it the spent form stays on the
        // stack and hardware back returns to it.
        expect(navigateMock).toHaveBeenCalledWith({
            to: "/profile",
            replace: true,
        });
    });

    it("pops history from the conflict step too", async () => {
        sendCodeMock.mockResolvedValue({
            status: "conflict",
            authenticatorIds: ["other-credential"],
            wallet: "0x1234567890123456789012345678901234567890",
        });
        render(<AddEmail />);

        fireEvent.change(screen.getByLabelText("wallet.addEmail.label"), {
            target: { value: "taken@frak.id" },
        });
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.addEmail.continue" })
        );

        await waitFor(() =>
            expect(
                screen.getByText("wallet.addEmail.conflict.useDifferent")
            ).toBeInTheDocument()
        );

        clickBack();

        expect(historyBackMock).toHaveBeenCalledTimes(1);
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it("replaces this form when handing off to the verify screen", async () => {
        render(<AddEmail />);

        fireEvent.change(screen.getByLabelText("wallet.addEmail.label"), {
            target: { value: "new@frak.id" },
        });
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.addEmail.continue" })
        );

        await waitFor(() =>
            expect(navigateMock).toHaveBeenCalledWith({
                to: "/profile/verify-email",
                replace: true,
            })
        );
    });
});

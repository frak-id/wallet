import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const {
    mockNavigate,
    mockSessionStore,
    mockExecutePendingActions,
    mockOnSuccess,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSessionStore: vi.fn(),
    mockExecutePendingActions: vi.fn(),
    mockOnSuccess: vi.fn<() => void>(),
}));

vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-router")
    >("@tanstack/react-router");
    return {
        ...actual,
        Link: ({ children, to }: { children: ReactNode; to: string }) => (
            <a href={to}>{children}</a>
        ),
        useNavigate: () => mockNavigate,
    };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        HandleErrors: () => null,
        sessionStore: (selector: (state: { session: unknown }) => unknown) =>
            mockSessionStore(selector),
    };
});

vi.mock("@/module/authentication/component/AuthActions", () => ({
    AuthActions: ({ onSuccess }: { onSuccess: () => void }) => {
        mockOnSuccess.mockImplementation(onSuccess);
        return (
            <button type="button" onClick={onSuccess}>
                auth-actions
            </button>
        );
    },
}));

vi.mock("@/module/authentication/component/AuthenticateWithPhone", () => ({
    AuthenticateWithPhone: () => <div>authenticate-with-phone</div>,
}));

vi.mock("@/module/authentication/component/LoginList", () => ({
    LoginList: () => <div>login-list</div>,
}));

vi.mock("@/module/common/component/StepLayout", () => ({
    StepLayout: ({
        children,
        footer,
    }: {
        children: ReactNode;
        footer: ReactNode;
    }) => (
        <div>
            {children}
            {footer}
        </div>
    ),
}));

vi.mock("@/module/pairing/component/PairingInProgress", () => ({
    PairingInProgress: () => <div>pairing-in-progress</div>,
}));

vi.mock("@/module/pending-actions/utils/executePendingActions", () => ({
    executePendingActions: (...args: unknown[]) =>
        mockExecutePendingActions(...args),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

import { Route } from "./login";

const LoginPage = Route.options.component!;

describe("LoginPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecutePendingActions.mockResolvedValue(false);
    });

    test("should not redirect when unauthenticated", async () => {
        mockSessionStore.mockImplementation(
            (selector: (state: { session: unknown }) => unknown) =>
                selector({ session: null })
        );

        render(<LoginPage />);

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockExecutePendingActions).not.toHaveBeenCalled();
    });

    test("should navigate to /wallet when authenticated with no pending actions", async () => {
        mockSessionStore.mockImplementation(
            (selector: (state: { session: unknown }) => unknown) =>
                selector({ session: { token: "tok" } })
        );

        render(<LoginPage />);

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/wallet",
                replace: true,
            });
        });
    });

    test("should execute pending actions when authenticated and let them navigate", async () => {
        mockSessionStore.mockImplementation(
            (selector: (state: { session: unknown }) => unknown) =>
                selector({ session: { token: "tok" } })
        );
        mockExecutePendingActions.mockResolvedValue(true);

        render(<LoginPage />);

        await waitFor(() => {
            expect(mockExecutePendingActions).toHaveBeenCalledWith(
                mockNavigate
            );
        });

        // Should NOT fallback to /wallet since pending actions handled navigation
        expect(mockNavigate).not.toHaveBeenCalledWith(
            expect.objectContaining({ to: "/wallet" })
        );
    });

    test("should only redirect once even when both onSuccess and useEffect fire", async () => {
        mockSessionStore.mockImplementation(
            (selector: (state: { session: unknown }) => unknown) =>
                selector({ session: { token: "tok" } })
        );

        render(<LoginPage />);

        // Simulate onSuccess callback firing (as AuthActions would)
        mockOnSuccess();

        await waitFor(() => {
            // handlePostLoginRedirect uses a ref guard, so navigate should be called once
            expect(mockNavigate).toHaveBeenCalledTimes(1);
        });
    });
});

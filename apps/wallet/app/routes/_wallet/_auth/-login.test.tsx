import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const { mockNavigate, mockExecutePendingActions, mockOnSuccess, mockSearch } =
    vi.hoisted(() => ({
        mockNavigate: vi.fn(),
        mockExecutePendingActions: vi.fn(),
        mockOnSuccess: vi.fn<() => void>(),
        mockSearch: { current: {} as { ref?: string } },
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
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => mockSearch.current,
        }),
    };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
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

vi.mock("@/module/pending-actions/hook/useExecutePendingActions", () => ({
    useExecutePendingActions: () => ({
        executePendingActions: (...args: unknown[]) =>
            mockExecutePendingActions(...args),
        isPending: false,
        isError: false,
        error: null,
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

import { Route } from "./login.index";

const LoginPage = Route.options.component!;

describe("LoginPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecutePendingActions.mockResolvedValue(false);
        mockSearch.current = {};
    });

    test("should render without auto-redirecting", () => {
        render(<LoginPage />);

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(mockExecutePendingActions).not.toHaveBeenCalled();
    });

    test("should navigate to /wallet via onSuccess when no pending actions", async () => {
        render(<LoginPage />);

        // Simulate AuthActions calling onSuccess after WebAuthn auth
        mockOnSuccess();

        await waitFor(() => {
            expect(mockExecutePendingActions).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/wallet",
                replace: true,
            });
        });
    });

    test("should let pending actions handle navigation via onSuccess", async () => {
        mockExecutePendingActions.mockResolvedValue(true);

        render(<LoginPage />);

        // Simulate AuthActions calling onSuccess after WebAuthn auth
        mockOnSuccess();

        await waitFor(() => {
            expect(mockExecutePendingActions).toHaveBeenCalled();
        });
        // Should NOT fallback to /wallet since pending actions handled navigation
        expect(mockNavigate).not.toHaveBeenCalledWith(
            expect.objectContaining({ to: "/wallet" })
        );
    });

    test("should redirect to the redeem page with a forwarded ref when there are no pending actions", async () => {
        mockSearch.current = { ref: "FRAKPA" };

        render(<LoginPage />);
        mockOnSuccess();

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith({
                to: "/profile/referral/redeem",
                search: { code: "FRAKPA" },
                replace: true,
            });
        });
    });

    test("pending-action navigation wins over a forwarded ref", async () => {
        mockSearch.current = { ref: "FRAKPA" };
        mockExecutePendingActions.mockResolvedValue(true);

        render(<LoginPage />);
        mockOnSuccess();

        await waitFor(() => {
            expect(mockExecutePendingActions).toHaveBeenCalled();
        });
        expect(mockNavigate).not.toHaveBeenCalledWith(
            expect.objectContaining({ to: "/profile/referral/redeem" })
        );
    });
});

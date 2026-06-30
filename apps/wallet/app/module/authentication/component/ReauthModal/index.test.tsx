import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
    let _onOpenChange: ((open: boolean) => void) | null = null;

    return {
        // ResponsiveModal: capture onOpenChange so tests can trigger dismiss.
        capturedOnOpenChange: () => _onOpenChange,
        onOpenChange: vi.fn((fn: (open: boolean) => void) => {
            _onOpenChange = fn;
        }),

        // useLogin
        login: vi.fn(),

        // useLogout
        logout: vi.fn(),

        // useLastAuthenticatorHint
        hint: null as unknown,

        // getSafeSession — drives both the open-time snapshot and dismiss check
        getSafeSession: vi.fn<
            () => { token?: string; authenticatorId?: string } | null
        >(() => ({ token: "wallet-token" })),
    };
});

vi.mock("@frak-labs/design-system/components/ResponsiveModal", () => ({
    ResponsiveModal: ({
        children,
        onOpenChange,
    }: {
        children: React.ReactNode;
        open: boolean;
        onOpenChange: (open: boolean) => void;
        title: string;
        description: string;
    }) => {
        mocks.onOpenChange(onOpenChange);
        return <div data-testid="modal">{children}</div>;
    },
}));

vi.mock("@frak-labs/design-system/icons", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return { ...actual, FaceIdIcon: () => <svg data-testid="faceid-icon" /> };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        useLogin: () => ({ login: mocks.login, isLoading: false }),
    };
});

vi.mock("@frak-labs/wallet-shared/common/utils/safeSession", () => ({
    getSafeSession: mocks.getSafeSession,
}));

vi.mock("@/module/authentication/hook/useLastAuthenticatorHint", () => ({
    useLastAuthenticatorHint: () => mocks.hint,
}));

vi.mock("@/module/authentication/hook/useLogout", () => ({
    useLogout: () => ({ logout: mocks.logout, isLoggingOut: false }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

// ---------------------------------------------------------------------------

import type React from "react";
import { ReauthModal } from "./index";

const dismiss = () => mocks.capturedOnOpenChange()?.(false);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hint = null;
    mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("ReauthModal dismiss policy", () => {
    test("reason 'grace' → dismissable: backdrop/ESC just closes, never logs out", async () => {
        const onClose = vi.fn();
        render(<ReauthModal reason="grace" onClose={onClose} />);

        dismiss();

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("reason 'grace' → shows only Verify identity (no Log out button)", () => {
        render(<ReauthModal reason="grace" onClose={vi.fn()} />);

        expect(
            screen.getByRole("button", { name: "Verify identity" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Log out" })
        ).not.toBeInTheDocument();
    });

    test("reason 'dead' → LOCKED: a backdrop/ESC dismiss does nothing (no close, no logout)", () => {
        const onClose = vi.fn();
        render(<ReauthModal reason="dead" onClose={onClose} />);

        dismiss();

        expect(onClose).not.toHaveBeenCalled();
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("reason 'dead' → explicit Log out button logs out and closes", async () => {
        const onClose = vi.fn();
        render(<ReauthModal reason="dead" onClose={onClose} />);

        fireEvent.click(screen.getByRole("button", { name: "Log out" }));

        await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("reason 'dead' → Verify identity triggers re-auth login", () => {
        render(<ReauthModal reason="dead" onClose={vi.fn()} />);

        fireEvent.click(
            screen.getByRole("button", { name: "Verify identity" })
        );

        expect(mocks.login).toHaveBeenCalledTimes(1);
    });
});

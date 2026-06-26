import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
    let _onOpenChange: ((open: boolean) => void) | null = null;
    let _onPairingSuccess: (() => void | Promise<void>) | null = null;

    return {
        // Captures callbacks from children so tests can invoke them
        capturedOnOpenChange: () => _onOpenChange,
        capturedOnPairingSuccess: () => _onPairingSuccess,

        // ResponsiveModal: render children directly + capture onOpenChange
        onOpenChange: vi.fn((fn: (open: boolean) => void) => {
            _onOpenChange = fn;
        }),

        // PairingView: render a placeholder + capture onSuccess
        pairingViewRendered: vi.fn(),
        pairingViewHints: undefined as string[] | undefined,
        onPairingSuccess: vi.fn((fn: () => void | Promise<void>) => {
            _onPairingSuccess = fn;
        }),

        // getOriginPairingClient
        softReset: vi.fn(),

        // useLogout
        logout: vi.fn(),

        // getSafeSession / isExpired
        getSafeSession: vi.fn<() => { token: string } | null>(() => null),
        isExpired: vi.fn<() => boolean>(() => true),

        // useQueryClient
        invalidateQueries: vi.fn(),
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
        // Capture so tests can trigger dismiss via onOpenChange(false)
        mocks.onOpenChange(onOpenChange);
        return <div data-testid="modal">{children}</div>;
    },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        PairingView: ({
            authenticatorHints,
            onSuccess,
        }: {
            title: string;
            description: string;
            authenticatorHints?: string[];
            onSuccess?: () => void | Promise<void>;
        }) => {
            mocks.pairingViewRendered();
            mocks.pairingViewHints = authenticatorHints;
            mocks.onPairingSuccess(onSuccess ?? (() => {}));
            return <div data-testid="pairing-view" />;
        },
        getOriginPairingClient: () => ({
            softReset: mocks.softReset,
        }),
    };
});

vi.mock("@frak-labs/wallet-shared/common/utils/safeSession", () => ({
    getSafeSession: mocks.getSafeSession,
}));

vi.mock("@frak-labs/wallet-shared/common/utils/tokenExpiry", () => ({
    isExpired: mocks.isExpired,
}));

vi.mock("@/module/authentication/hook/useLogout", () => ({
    useLogout: () => ({ logout: mocks.logout, isLoggingOut: false }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

// Vanilla-extract CSS modules produce empty objects in tests — stub it.
vi.mock("@frak-labs/design-system/icons", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return { ...actual, QrCodeIcon: () => <svg data-testid="qr-icon" /> };
});

// ---------------------------------------------------------------------------

import type React from "react";
import { DistantReauthModal } from "./index";

const HINTS = ["cred-abc"];

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSafeSession.mockReturnValue(null); // token is dead by default
    mocks.isExpired.mockReturnValue(true);
    mocks.pairingViewHints = undefined;
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("DistantReauthModal", () => {
    test("(a) phase 1 shows Reconnect button, PairingView NOT rendered", () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        expect(
            screen.getByRole("button", { name: "Reconnect" })
        ).toBeInTheDocument();
        expect(mocks.pairingViewRendered).not.toHaveBeenCalled();
        expect(screen.queryByTestId("pairing-view")).not.toBeInTheDocument();
    });

    test("(b) clicking Reconnect mounts PairingView with correct authenticatorHints", async () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));

        await waitFor(() => {
            expect(mocks.pairingViewRendered).toHaveBeenCalled();
        });
        expect(mocks.pairingViewHints).toEqual(HINTS);
        expect(screen.getByTestId("pairing-view")).toBeInTheDocument();
    });

    test("(b) clicking Reconnect does NOT touch the pairing singleton (no pre-reset)", async () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
        await waitFor(() =>
            expect(mocks.pairingViewRendered).toHaveBeenCalled()
        );

        // The singleton's own forceConnect handles any in-flight pairing; the
        // modal must NOT softReset on start (that would bypass the safe path).
        expect(mocks.softReset).not.toHaveBeenCalled();
    });

    test("(c) dismiss before starting → logout called, softReset NOT called", async () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        // Dismiss via onOpenChange(false) without ever clicking Reconnect
        const cb = mocks.capturedOnOpenChange();
        cb?.(false);

        await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
        expect(mocks.softReset).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("(d) dismiss after starting → softReset called then logout", async () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        // Phase 2: start pairing
        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
        await waitFor(() =>
            expect(mocks.pairingViewRendered).toHaveBeenCalled()
        );

        // Dismiss via onOpenChange(false)
        const cb = mocks.capturedOnOpenChange();
        cb?.(false);

        await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
        // softReset fires once — on dismiss only (start never touches it).
        expect(mocks.softReset).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("(d) dismiss after starting → no logout when freshness check passes", async () => {
        // Session re-paired in another tab: token is fresh
        mocks.isExpired.mockReturnValue(false);
        mocks.getSafeSession.mockReturnValue({ token: "fresh-token" });

        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
        await waitFor(() =>
            expect(mocks.pairingViewRendered).toHaveBeenCalled()
        );

        const cb = mocks.capturedOnOpenChange();
        cb?.(false);

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        // Fresh session → no logout
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("(e) success → invalidate + onClose; subsequent dismiss is no-op (settledRef)", async () => {
        const onClose = vi.fn();
        render(
            <DistantReauthModal authenticatorHints={HINTS} onClose={onClose} />
        );

        fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
        await waitFor(() =>
            expect(mocks.pairingViewRendered).toHaveBeenCalled()
        );

        // Fire pairing success (what applyDistantSession triggers)
        const successCb = mocks.capturedOnPairingSuccess();
        await successCb?.();

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(mocks.invalidateQueries).toHaveBeenCalledTimes(1);

        // Now trigger dismiss — settledRef prevents a second onClose + logout
        const cb = mocks.capturedOnOpenChange();
        cb?.(false);

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1)); // still 1
        expect(mocks.logout).not.toHaveBeenCalled();
    });
});

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
    // useLogin — one shared login spy; each useLogin() call's options are
    // captured in order so tests can drive the instance's onError directly.
    // Call order in AuthActions: [0] manual login, [1] silent quick-login.
    // Returns a resolved promise to mirror `mutateAsync` (the auto-fire path
    // chains `.catch` on the returned promise).
    login: vi.fn(() => Promise.resolve()),
    loginOptions: [] as Array<{
        onSuccess?: () => void;
        onError?: (error: Error | null) => void;
    }>,
    hint: null as unknown,
    clearLastAuthenticator: vi.fn(async () => {}),
    invalidateQueries: vi.fn(async () => {}),
    trackEvent: vi.fn(),
    navigate: vi.fn(),
    // Mutable so individual tests can simulate the web (non-Tauri) build.
    isTauri: true,
    // Mutable so tests can simulate Android (reliable `no-credential`) vs
    // iOS/web (where a silent `no-credential` is a false negative).
    isAndroid: false,
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/app-essentials/utils/platform")
        >();
    return {
        ...actual,
        get IS_TAURI() {
            return mocks.isTauri;
        },
        get IS_ANDROID() {
            return mocks.isAndroid;
        },
    };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        // Force supported so the effect + buttons render in jsdom.
        isWebAuthNSupported: true,
        trackEvent: mocks.trackEvent,
        useLogin: (opts: (typeof mocks.loginOptions)[number]) => {
            mocks.loginOptions.push(opts);
            return { login: mocks.login, isLoading: false };
        },
        clearLastAuthenticator: mocks.clearLastAuthenticator,
        // classifyWebauthnError + authKey use the real implementations.
    };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-query")>();
    return {
        ...actual,
        useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
    };
});

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("@/module/authentication/hook/useLastAuthenticatorHint", () => ({
    useLastAuthenticatorHint: () => mocks.hint,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}));

vi.mock("@frak-labs/design-system/components/Box", () => ({
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@frak-labs/design-system/components/Text", () => ({
    Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@frak-labs/design-system/components/Button", () => ({
    Button: ({
        children,
        onClick,
        disabled,
    }: {
        children: React.ReactNode;
        onClick?: () => void;
        disabled?: boolean;
    }) => (
        <button type="button" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}));
vi.mock("@frak-labs/design-system/icons", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return { ...actual, FaceIdIcon: () => <svg data-testid="faceid-icon" /> };
});

// ---------------------------------------------------------------------------

import { authKey } from "@frak-labs/wallet-shared";
import { fireEvent } from "@testing-library/react";
import type React from "react";
import { StrictMode } from "react";
import { AuthActions } from "./AuthActions";

const HINT = {
    wallet: "0xabc" as `0x${string}`,
    authenticatorId: "auth-1",
    transports: undefined,
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hint = null;
    mocks.loginOptions = [];
    mocks.isTauri = true;
    mocks.isAndroid = false;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("AuthActions silent quick-login", () => {
    test("iOS auto-fires a non-silent full-sheet login on mount", async () => {
        // iOS's silent `preferImmediatelyAvailable` path rejects even for a
        // usable passkey on prod, so iOS uses the reliable full-sheet call.
        mocks.hint = HINT;
        mocks.isAndroid = false;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
        expect(mocks.login).toHaveBeenCalledWith({
            lastAuthentication: HINT,
            silentLogin: false,
            trigger: "auto",
        });
    });

    test("Android auto-fires the silent fast-path login on mount", async () => {
        mocks.hint = HINT;
        mocks.isAndroid = true;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
        expect(mocks.login).toHaveBeenCalledWith({
            lastAuthentication: HINT,
            silentLogin: true,
            trigger: "auto",
        });
    });

    test("shows the auto-reconnect toast on mount, then hides it once the attempt settles", async () => {
        mocks.hint = HINT;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        // Visible during the pre-fire beat.
        expect(screen.getByText("wallet.login.autoReconnect")).toBeTruthy();

        // Fires after the delay, then the toast clears on settle.
        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(screen.queryByText("wallet.login.autoReconnect")).toBeNull()
        );
    });

    test("does not show the toast or fire silent login when there is no hint", async () => {
        mocks.hint = null;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        // Give the effect a chance to (not) run.
        await new Promise((r) => setTimeout(r, 0));
        expect(mocks.login).not.toHaveBeenCalled();
        expect(screen.queryByText("wallet.login.autoReconnect")).toBeNull();

        // The no-hint primary button performs a plain login with no flag.
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.login.button" })
        );
        expect(mocks.login).toHaveBeenCalledWith({});
    });

    test("Android no-credential outcome clears all three authenticator surfaces and suppresses the toast", async () => {
        mocks.hint = HINT;
        mocks.isAndroid = true;
        const onError = vi.fn();
        render(<AuthActions onSuccess={vi.fn()} onError={onError} />);

        await waitFor(() =>
            expect(mocks.loginOptions.length).toBeGreaterThan(1)
        );
        // [1] is the silent quick-login instance.
        const silentOnError = mocks.loginOptions[1]?.onError;
        expect(silentOnError).toBeTypeOf("function");

        await silentOnError?.(new Error("no credential available"));

        // clearLastAuthenticator is the single call that clears zustand, the
        // cloud hint, AND (via the passed wallet) the IDB row.
        expect(mocks.clearLastAuthenticator).toHaveBeenCalledTimes(1);
        expect(mocks.clearLastAuthenticator).toHaveBeenCalledWith(HINT.wallet);
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
            queryKey: authKey.recoveryHint,
        });
        // The self-heal fires alongside the cleanup so it's distinguishable
        // from a real login failure in analytics.
        expect(mocks.trackEvent).toHaveBeenCalledWith("auth_login_self_heal", {
            reason: "stale_hint_clear_attempted",
        });
        // The page-level error toast must NOT receive the swallowed error.
        expect(onError).not.toHaveBeenCalledWith(expect.any(Error));
    });

    test("a failed auto-fire is swallowed: no toast, hint kept", async () => {
        // The auto-fire is not user-initiated, so a failure must never surface
        // an error toast (the prod-iOS generic error was doing exactly that) —
        // it just falls through to the manual buttons.
        mocks.hint = HINT;
        const onError = vi.fn();
        render(<AuthActions onSuccess={vi.fn()} onError={onError} />);

        await waitFor(() =>
            expect(mocks.loginOptions.length).toBeGreaterThan(1)
        );
        const silentOnError = mocks.loginOptions[1]?.onError;

        await silentOnError?.(new Error("Une erreur est survenue"));

        expect(onError).not.toHaveBeenCalledWith(expect.any(Error));
        expect(mocks.clearLastAuthenticator).not.toHaveBeenCalled();
        expect(mocks.trackEvent).not.toHaveBeenCalledWith(
            "auth_login_self_heal",
            expect.anything()
        );
    });

    test("iOS no-credential is a false negative: keeps the hint and suppresses the toast", async () => {
        // On iOS the silent `preferImmediatelyAvailableCredentials` attempt
        // reports `no-credential` even when a usable iCloud passkey exists, so
        // the destructive self-heal must NOT run — otherwise every `/login`
        // visit wipes the hint and drops the user onto `/register`.
        mocks.hint = HINT;
        mocks.isAndroid = false;
        const onError = vi.fn();
        render(<AuthActions onSuccess={vi.fn()} onError={onError} />);

        await waitFor(() =>
            expect(mocks.loginOptions.length).toBeGreaterThan(1)
        );
        const silentOnError = mocks.loginOptions[1]?.onError;

        await silentOnError?.(new Error("no credential available"));

        // The durable surfaces stay intact (no wipe) and no toast is shown.
        expect(mocks.clearLastAuthenticator).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalledWith(expect.any(Error));
        // iOS never self-heals, so no self-heal event either.
        expect(mocks.trackEvent).not.toHaveBeenCalledWith(
            "auth_login_self_heal",
            expect.anything()
        );
    });

    test("does not auto-fire on web (non-Tauri) even with a hint", async () => {
        mocks.hint = HINT;
        mocks.isTauri = false;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        // Give the effect a chance to (not) run.
        await new Promise((r) => setTimeout(r, 0));
        expect(mocks.login).not.toHaveBeenCalled();

        // The manual "use my account" button still works with a plain login.
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.login.useMyAccount" })
        );
        expect(mocks.login).toHaveBeenCalledWith({ lastAuthentication: HINT });
    });

    test("still fires the silent login under StrictMode (double-mount)", async () => {
        // Regression guard: the fire-time guard must let StrictMode's second
        // mount reschedule after the first mount's timer is cancelled by
        // cleanup. A schedule-time guard leaves the login unfired and the
        // spinner/toast stuck.
        mocks.hint = HINT;
        render(
            <StrictMode>
                <AuthActions onSuccess={vi.fn()} onError={vi.fn()} />
            </StrictMode>
        );
        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(screen.queryByText("wallet.login.autoReconnect")).toBeNull()
        );
    });

    test("does not re-fire the silent login on re-render", async () => {
        mocks.hint = HINT;
        const { rerender } = render(
            <AuthActions onSuccess={vi.fn()} onError={vi.fn()} />
        );
        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));

        rerender(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);
        await new Promise((r) => setTimeout(r, 0));
        expect(mocks.login).toHaveBeenCalledTimes(1);
    });
});

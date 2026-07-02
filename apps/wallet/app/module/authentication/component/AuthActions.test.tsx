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
    clear: vi.fn(async () => {}),
    setLastAuthenticator: vi.fn(),
    invalidateQueries: vi.fn(async () => {}),
    trackEvent: vi.fn(),
    navigate: vi.fn(),
    // Mutable so individual tests can simulate the web (non-Tauri) build.
    isTauri: true,
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
        recoveryHintStorage: {
            ...actual.recoveryHintStorage,
            clear: mocks.clear,
        },
        authenticationStore: {
            ...actual.authenticationStore,
            getState: () => ({
                setLastAuthenticator: mocks.setLastAuthenticator,
            }),
        },
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
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("AuthActions silent quick-login", () => {
    test("fires silent login once on mount when a hint exists", async () => {
        mocks.hint = HINT;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
        expect(mocks.login).toHaveBeenCalledWith({
            lastAuthentication: HINT,
            silentLogin: true,
        });
    });

    test("does not fire silent login when there is no hint", async () => {
        mocks.hint = null;
        render(<AuthActions onSuccess={vi.fn()} onError={vi.fn()} />);

        // Give the effect a chance to (not) run.
        await new Promise((r) => setTimeout(r, 0));
        expect(mocks.login).not.toHaveBeenCalled();

        // The no-hint primary button performs a plain login with no flag.
        fireEvent.click(
            screen.getByRole("button", { name: "wallet.login.button" })
        );
        expect(mocks.login).toHaveBeenCalledWith({});
    });

    test("no-credential outcome clears both hint sources and suppresses the toast", async () => {
        mocks.hint = HINT;
        const onError = vi.fn();
        render(<AuthActions onSuccess={vi.fn()} onError={onError} />);

        await waitFor(() =>
            expect(mocks.loginOptions.length).toBeGreaterThan(1)
        );
        // [1] is the silent quick-login instance.
        const silentOnError = mocks.loginOptions[1]?.onError;
        expect(silentOnError).toBeTypeOf("function");

        await silentOnError?.(new Error("no credential available"));

        expect(mocks.setLastAuthenticator).toHaveBeenCalledWith(null);
        expect(mocks.clear).toHaveBeenCalledTimes(1);
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
            queryKey: authKey.recoveryHint,
        });
        // The page-level error toast must NOT receive the swallowed error.
        expect(onError).not.toHaveBeenCalledWith(expect.any(Error));
    });

    test("a non-no-credential error routes through the page onError and keeps the hint", async () => {
        mocks.hint = HINT;
        const onError = vi.fn();
        render(<AuthActions onSuccess={vi.fn()} onError={onError} />);

        await waitFor(() =>
            expect(mocks.loginOptions.length).toBeGreaterThan(1)
        );
        const silentOnError = mocks.loginOptions[1]?.onError;

        const cancelled = new Error("user cancelled");
        await silentOnError?.(cancelled);

        expect(onError).toHaveBeenCalledWith(cancelled);
        expect(mocks.clear).not.toHaveBeenCalled();
        expect(mocks.setLastAuthenticator).not.toHaveBeenCalled();
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

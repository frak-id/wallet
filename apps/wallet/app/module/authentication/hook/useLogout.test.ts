import { act, renderHook } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const mockNavigate = vi.fn();
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockClearSession = vi.fn();
const mockTrackEvent = vi.fn();

// The shared router mock in test-foundation is not applied to wallet unit
// tests, so `useNavigate` is the real export here and has to be mocked
// locally. Only the hook this file exercises is stubbed.
vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("@/module/notification/adapter", () => ({
    notificationAdapter: {
        unsubscribe: mockUnsubscribe,
    },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        trackEvent: mockTrackEvent,
        sessionStore: {
            getState: () => ({
                clearSession: mockClearSession,
            }),
        },
    };
});

describe("useLogout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        window.localStorage.clear();
    });

    async function runLogout(
        wrapper: React.ComponentType<{
            children: React.ReactNode;
        }>
    ) {
        const { useLogout } = await import("./useLogout");
        const { result } = renderHook(() => useLogout(), { wrapper });
        await act(async () => {
            await result.current.logout();
            await vi.advanceTimersByTimeAsync(100);
        });
    }

    test("removes a legacy frak_demoPrivateKey from localStorage", async ({
        queryWrapper,
    }) => {
        window.localStorage.setItem("frak_demoPrivateKey", "0xlegacykey");

        await runLogout(queryWrapper.wrapper);

        expect(window.localStorage.getItem("frak_demoPrivateKey")).toBeNull();
    });

    test("preserves the existing scrub behavior", async ({ queryWrapper }) => {
        window.localStorage.setItem("REACT_QUERY_OFFLINE_CACHE", "1");
        window.localStorage.setItem("frak_theme", "dark");
        window.localStorage.setItem("frak_session", "1");
        window.localStorage.setItem("frak_sdkSession", "1");
        window.localStorage.setItem("frak_user", "1");
        window.localStorage.setItem("frak_userSetupLater", "1");

        await runLogout(queryWrapper.wrapper);

        expect(
            window.localStorage.getItem("REACT_QUERY_OFFLINE_CACHE")
        ).toBeNull();
        expect(window.localStorage.getItem("frak_theme")).toBeNull();
        expect(window.localStorage.getItem("frak_session")).toBeNull();
        expect(window.localStorage.getItem("frak_sdkSession")).toBeNull();
        expect(window.localStorage.getItem("frak_user")).toBeNull();
        expect(window.localStorage.getItem("frak_userSetupLater")).toBeNull();
    });

    // NOTE: the `panelDismissed*` sweep in `cleanLocalStorage` iterates
    // `Object.keys(window.localStorage)`, which the shared harness's
    // `StorageImpl` (packages/test-foundation/src/shared-setup.ts) does not
    // support — its backing Map is a class field, so `Object.keys` returns
    // `data` rather than the stored keys. Asserting the sweep requires
    // making `StorageImpl` proxy its own enumerable keys, which is shared
    // test infra used by every workspace and is tracked separately. The
    // fixed-key removal above is unaffected.

    test("preserves the persisted quick-login authenticator hint", async ({
        queryWrapper,
    }) => {
        // The only hint surface logout could plausibly clobber here is the
        // persisted authentication store: `authenticatorStorage` is
        // idb-keyval and `recoveryHintStorage` is Tauri-only (inert under
        // jsdom). Seeding the real key keeps this falsifiable — adding it to
        // the scrub list turns this test red.
        const hint = JSON.stringify({
            state: {
                lastAuthenticator: {
                    authenticatorId: "cred-1",
                    wallet: "0xabc",
                },
            },
        });
        window.localStorage.setItem("frak_authentication_store", hint);

        await runLogout(queryWrapper.wrapper);

        expect(window.localStorage.getItem("frak_authentication_store")).toBe(
            hint
        );
    });

    test("does not force-remove frak_session_store", async ({
        queryWrapper,
    }) => {
        window.localStorage.setItem(
            "frak_session_store",
            JSON.stringify({
                state: {
                    session: null,
                    sdkSession: null,
                    demoPrivateKey: null,
                },
            })
        );

        await runLogout(queryWrapper.wrapper);

        expect(
            window.localStorage.getItem("frak_session_store")
        ).not.toBeNull();
    });

    test("does not throw when frak_demoPrivateKey is already absent", async ({
        queryWrapper,
    }) => {
        expect(window.localStorage.getItem("frak_demoPrivateKey")).toBeNull();

        await runLogout(queryWrapper.wrapper);

        expect(window.localStorage.getItem("frak_demoPrivateKey")).toBeNull();
        expect(mockNavigate).toHaveBeenCalled();
    });
});

/**
 * useWalletSessionGuard tests
 *
 * Suppression is derived from the mocked modal store (mocks.modalRef), so a
 * re-auth modal that is "open" suppresses further prompts and closing it
 * (mocks.closeModalForTest) re-enables them.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — defined before any module is loaded.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
    // Mutable auth-expired callback so individual tests can trigger it.
    let _authExpiredCb: (() => void) | null = null;
    // Stateful modal container so isReauthOpen() reflects open/close.
    const modalRef = { current: null as { id: string } | null };

    return {
        modalRef,
        closeModalForTest: () => {
            modalRef.current = null;
        },
        // tokenExpiry
        isExpired: vi.fn<() => boolean>(() => false),
        expiresWithinMs: vi.fn<() => boolean>(() => false),
        WALLET_REAUTH_BEFORE_MS: 7 * 24 * 60 * 60 * 1000,

        // safeSession
        getSafeSession: vi.fn<
            () => {
                token: string;
                type?: string;
                authenticatorId?: string;
            } | null
        >(() => ({
            token: "wallet-token",
        })),

        // authenticationStore — used by guard for fallback authenticatorId
        lastRemoteAuthenticator: null as { authenticatorId: string } | null,

        // logout (used for sessions that can't re-auth locally)
        logout: vi.fn(),

        // authRecovery
        subscribeToWalletAuthExpired: vi.fn((cb: () => void) => {
            _authExpiredCb = cb;
            return () => {
                _authExpiredCb = null;
            };
        }),
        triggerAuthExpired: () => _authExpiredCb?.(),

        // modalStore — openModal records the active modal so suppression works
        openModal: vi.fn((m: { id: string }) => {
            modalRef.current = m;
        }),

        // sessionBannerStore
        bannerShow: vi.fn(),

        // biometrics
        isLocked: false as boolean,
        IS_TAURI: false as boolean,
    };
});

vi.mock("@frak-labs/wallet-shared/common/utils/tokenExpiry", () => ({
    isExpired: mocks.isExpired,
    expiresWithinMs: mocks.expiresWithinMs,
    WALLET_REAUTH_BEFORE_MS: mocks.WALLET_REAUTH_BEFORE_MS,
}));

vi.mock("@frak-labs/wallet-shared/common/utils/safeSession", () => ({
    getSafeSession: mocks.getSafeSession,
}));

vi.mock("@frak-labs/wallet-shared/common/auth/authRecovery", () => ({
    subscribeToWalletAuthExpired: mocks.subscribeToWalletAuthExpired,
}));

vi.mock("@/module/authentication/hook/useLogout", () => ({
    useLogout: () => ({ logout: mocks.logout, isLoggingOut: false }),
}));

vi.mock("@/module/stores/modalStore", () => ({
    modalStore: {
        getState: () => ({
            modal: mocks.modalRef.current,
            stack: [],
            openModal: mocks.openModal,
        }),
    },
}));

vi.mock("@/module/common/component/SessionExpiringBanner", () => ({
    sessionBannerStore: {
        getState: () => ({ show: mocks.bannerShow }),
    },
}));

vi.mock("@/module/biometrics/stores/biometricsStore", () => ({
    biometricsStore: {
        getState: () => ({ isLocked: mocks.isLocked }),
        // Zustand useStore compatibility: subscribe (not used in mock)
    },
    selectIsLocked: (s: { isLocked: boolean }) => s.isLocked,
}));

// Override zustand's useStore to call the selector synchronously against
// the mock store state rather than creating a real subscription.
vi.mock("zustand", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        useStore: (
            store: { getState: () => object },
            selector?: (s: object) => unknown
        ) => {
            const state = store.getState();
            return selector ? selector(state) : state;
        },
    };
});

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return mocks.IS_TAURI;
    },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
        ...actual,
        authenticationStore: {
            getState: () => ({
                lastRemoteAuthenticator: mocks.lastRemoteAuthenticator,
            }),
        },
    };
});

// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLocked = false;
    mocks.IS_TAURI = false;
    mocks.isExpired.mockReturnValue(false);
    mocks.expiresWithinMs.mockReturnValue(false);
    mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
    mocks.modalRef.current = null;
    mocks.lastRemoteAuthenticator = null;
    vi.useFakeTimers();
    vi.resetModules();
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe("useWalletSessionGuard", () => {
    test("does nothing when session is healthy", async () => {
        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).not.toHaveBeenCalled();
        expect(mocks.bannerShow).not.toHaveBeenCalled();
    });

    test("shows grace banner when token is within grace window (not expired)", async () => {
        mocks.expiresWithinMs.mockReturnValue(true); // within 7-day window
        // isExpired stays false (still valid)

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.bannerShow).toHaveBeenCalledTimes(1);
        expect(mocks.openModal).not.toHaveBeenCalled();
    });

    test("opens blocking modal when token is expired", async () => {
        mocks.isExpired.mockReturnValue(true);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).toHaveBeenCalledWith(
            expect.objectContaining({ id: "reauth", expired: true })
        );
        expect(mocks.bannerShow).not.toHaveBeenCalled();
    });

    test("opens re-auth modal on server-confirmed 401 (expired: false)", async () => {
        // Token is healthy locally — only the server 401 triggers the modal.
        mocks.isExpired.mockReturnValue(false);
        mocks.expiresWithinMs.mockReturnValue(false);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).not.toHaveBeenCalled();

        act(() => {
            mocks.triggerAuthExpired();
        });

        expect(mocks.openModal).toHaveBeenCalledWith(
            expect.objectContaining({ id: "reauth", expired: false })
        );
    });

    test("does NOT prompt proactively for a distant (paired) session even if expired", async () => {
        mocks.isExpired.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({
            token: "wallet-token",
            type: "distant-webauthn",
        });

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        // A paired session can't satisfy a local biometric prompt, so neither
        // the modal nor the banner should appear, and we must NOT log out on a
        // mere client-side expiry (server is the authority).
        expect(mocks.openModal).not.toHaveBeenCalled();
        expect(mocks.bannerShow).not.toHaveBeenCalled();
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("opens distant-reauth modal (not logout) on 401 for distant session with authenticatorId", async () => {
        mocks.getSafeSession.mockReturnValue({
            token: "wallet-token",
            type: "distant-webauthn",
            authenticatorId: "cred-abc",
        });

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        act(() => {
            mocks.triggerAuthExpired();
        });

        expect(mocks.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "distant-reauth",
                authenticatorHints: ["cred-abc"],
            })
        );
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("opens distant-reauth modal seeded from lastRemoteAuthenticator when session has no authenticatorId", async () => {
        // Session without an authenticatorId (shouldn't happen for distant-webauthn
        // in practice, but the durable-store fallback must be exercised).
        mocks.getSafeSession.mockReturnValue({
            token: "wallet-token",
            type: "distant-webauthn",
        });
        mocks.lastRemoteAuthenticator = { authenticatorId: "cred-fallback" };

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        act(() => {
            mocks.triggerAuthExpired();
        });

        expect(mocks.openModal).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "distant-reauth",
                authenticatorHints: ["cred-fallback"],
            })
        );
        expect(mocks.logout).not.toHaveBeenCalled();
    });

    test("logs out on 401 for ecdsa session (no re-pair path)", async () => {
        mocks.getSafeSession.mockReturnValue({
            token: "wallet-token",
            type: "ecdsa",
            authenticatorId: "ecdsa-demo",
        });

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        act(() => {
            mocks.triggerAuthExpired();
        });

        // ecdsa session: no re-pair path → logout only, never the re-pair modal.
        expect(mocks.logout).toHaveBeenCalledTimes(1);
        expect(mocks.openModal).not.toHaveBeenCalled();
    });

    test("logs out on 401 for distant session with no credential in session nor store", async () => {
        // Defensive: types guarantee distant-webauthn carries an authenticatorId,
        // but a legacy/corrupt persisted session could lack it. With no durable
        // lastRemoteAuthenticator fallback either, there is no re-pair hint → logout.
        mocks.getSafeSession.mockReturnValue({
            token: "wallet-token",
            type: "distant-webauthn",
        });
        mocks.lastRemoteAuthenticator = null;

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        act(() => {
            mocks.triggerAuthExpired();
        });

        expect(mocks.logout).toHaveBeenCalledTimes(1);
        expect(mocks.openModal).not.toHaveBeenCalled();
    });

    test("suppresses when Tauri BiometricLock is engaged", async () => {
        mocks.IS_TAURI = true;
        mocks.isLocked = true;
        mocks.isExpired.mockReturnValue(true); // Would normally open modal

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).not.toHaveBeenCalled();
        expect(mocks.bannerShow).not.toHaveBeenCalled();
    });

    test("does nothing when no session exists", async () => {
        mocks.getSafeSession.mockReturnValue(null);
        mocks.isExpired.mockReturnValue(true);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).not.toHaveBeenCalled();
    });

    test("re-evaluates on visibilitychange and opens modal when expired", async () => {
        // Start healthy
        mocks.isExpired.mockReturnValue(false);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).not.toHaveBeenCalled();

        // Simulate token becoming expired, then tab coming to foreground
        mocks.isExpired.mockReturnValue(true);
        act(() => {
            Object.defineProperty(document, "visibilityState", {
                configurable: true,
                value: "visible",
            });
            document.dispatchEvent(new Event("visibilitychange"));
        });

        expect(mocks.openModal).toHaveBeenCalledWith(
            expect.objectContaining({ id: "reauth", expired: true })
        );
    });

    test("suppresses a second prompt while a reauth modal is open", async () => {
        mocks.isExpired.mockReturnValue(true);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        // First evaluation opens the modal (modalRef now holds "reauth").
        expect(mocks.openModal).toHaveBeenCalledTimes(1);

        // Server 401 fires while the modal is still open.
        act(() => {
            mocks.triggerAuthExpired();
        });

        // Store-derived suppression prevents a second modal from opening.
        expect(mocks.openModal).toHaveBeenCalledTimes(1);
    });

    test("prompts again after the modal closes (any dismiss path)", async () => {
        mocks.isExpired.mockReturnValue(true);

        const { useWalletSessionGuard } = await import(
            "@/module/common/hook/useWalletSessionGuard"
        );

        renderHook(() => useWalletSessionGuard());

        expect(mocks.openModal).toHaveBeenCalledTimes(1);

        // Simulate the modal closing via ANY path (success or dismiss).
        act(() => {
            mocks.closeModalForTest();
        });

        // A later trigger must be able to open the modal again — the prior
        // leaked `isPrompting` flag would have blocked this forever.
        mocks.openModal.mockClear();
        act(() => {
            mocks.triggerAuthExpired();
        });

        expect(mocks.openModal).toHaveBeenCalledTimes(1);
    });
});

import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { authenticationStore } from "@frak-labs/wallet-shared";
import { subscribeToWalletAuthExpired } from "@frak-labs/wallet-shared/common/auth/authRecovery";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
import {
    expiresWithinMs,
    isExpired,
    WALLET_REAUTH_BEFORE_MS,
} from "@frak-labs/wallet-shared/common/utils/tokenExpiry";
import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useLogout } from "@/module/authentication/hook/useLogout";
import {
    biometricsStore,
    selectIsLocked,
} from "@/module/biometrics/stores/biometricsStore";
import { sessionBannerStore } from "@/module/common/component/SessionExpiringBanner";
import { modalStore } from "@/module/stores/modalStore";

/**
 * 60-second skew applied to the "is expired" check to account for clock drift.
 * Only destructive decisions (opening a blocking modal) use this.
 */
const EXPIRED_SKEW_MS = 60_000;

/**
 * How often (ms) to poll token expiry in the background.
 * Coarse — we don't need sub-minute precision.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Suppression is derived from the modal store rather than a standalone flag,
 * so it auto-clears on EVERY close path (success, dismiss-expired→logout,
 * dismiss-not-expired→close). A leaked flag would silently stop the guard from
 * ever prompting again for the rest of the page session.
 */
const REAUTH_MODAL_IDS = new Set<string>(["reauth", "distant-reauth"]);

function isReauthOpen(): boolean {
    const { modal, stack } = modalStore.getState();
    return (
        (modal !== null && REAUTH_MODAL_IDS.has(modal.id)) ||
        stack.some((m) => REAUTH_MODAL_IDS.has(m.id))
    );
}

/**
 * For non-local sessions (distant-webauthn / ecdsa), attempt to route to the
 * re-pair modal (distant-webauthn with a known credential) or fall back to a
 * hard logout (ecdsa, or distant session with no credential record).
 *
 * Extracted from `handleServerConfirmed401` to keep its cognitive complexity
 * within the linter's limit.
 */
function routeNonLocalSession(
    session: ReturnType<typeof getSafeSession>,
    logout: () => void
): void {
    if (session?.type === "distant-webauthn") {
        // The type guard is load-bearing: ecdsa sessions also carry an
        // `authenticatorId` (`ecdsa-...`) and must NOT open re-pair. Source:
        // live session first, durable store fallback if session was cleared.
        const authenticatorId =
            session.authenticatorId ??
            authenticationStore.getState().lastRemoteAuthenticator
                ?.authenticatorId;
        if (authenticatorId) {
            modalStore.getState().openModal({
                id: "distant-reauth",
                authenticatorHints: [authenticatorId],
            });
            return;
        }
    }
    void logout();
}

/**
 * Whether the session can be re-authenticated with a LOCAL biometric prompt.
 *
 * Only local webauthn sessions (`type` undefined or `"webauthn"`) hold a
 * passkey on THIS device. A distant (paired) session's credential lives on
 * another device, and an ecdsa (demo) session has no passkey at all — for both,
 * the biometric ReauthModal can never succeed, so they must be recovered by
 * logging out and re-pairing / re-registering instead.
 */
function canReauthLocally(session: { type?: string }): boolean {
    return session.type === undefined || session.type === "webauthn";
}

/**
 * Evaluate the current wallet token and take the appropriate action:
 *
 * - No session      → nothing (user isn't logged in; route guards handle it).
 * - Expired (+60s)  → open blocking re-auth modal.
 * - Grace window    → show passive snooze-able banner (once per tab).
 * - Healthy         → nothing.
 *
 * Suppressed while the Tauri BiometricLock is engaged to avoid stacking
 * a second biometric prompt on top of the lock screen.
 */
function evaluate() {
    // Suppress while Tauri biometric lock is engaged.
    if (IS_TAURI && biometricsStore.getState().isLocked) return;

    // Suppress if a re-auth prompt is already visible (active or stacked).
    if (isReauthOpen()) return;

    const session = getSafeSession();
    if (!session?.token) return; // Not logged in — nothing to guard.

    // Distant (paired) / ecdsa (demo) sessions can't satisfy a local biometric
    // prompt. Never prompt them proactively (client-`exp` must not drive a
    // destructive action here); the server-confirmed 401 path logs them out.
    if (!canReauthLocally(session)) return;

    if (isExpired(session.token, EXPIRED_SKEW_MS)) {
        modalStore.getState().openModal({
            id: "reauth",
            reason: "dead",
        });
        return;
    }

    if (expiresWithinMs(session.token, WALLET_REAUTH_BEFORE_MS)) {
        // Grace window — show the passive banner (snoozed after first dismiss).
        sessionBannerStore.getState().show();
    }
}

/**
 * Mount this inside `SessionStateManager` (RootProvider.tsx).
 *
 * Checks token expiry on:
 *  - Mount (once, after hydration)
 *  - `visibilitychange` to `visible` (tab re-focus)
 *  - A coarse 5-minute interval
 *  - Server-confirmed 401 via `subscribeToWalletAuthExpired`
 */
export function useWalletSessionGuard() {
    // Subscribe to Tauri lock state so we can re-evaluate after unlock.
    const isBiometricLocked = useStore(biometricsStore, selectIsLocked);
    const { logout } = useLogout();

    /**
     * Called when the server confirms a 401 (wallet token definitely dead).
     * - Local webauthn session → open the blocking re-auth modal.
     * - Distant (paired) / ecdsa (demo) session → cannot re-auth locally, so
     *   log out; the redirect lands the user on the re-pair / register flow.
     */
    const handleServerConfirmed401 = useCallback(() => {
        if (IS_TAURI && biometricsStore.getState().isLocked) return;
        if (isReauthOpen()) return;

        const session = getSafeSession();
        if (!session?.token) return; // Already cleared; route guard redirects.

        if (!canReauthLocally(session)) {
            routeNonLocalSession(session, logout);
            return;
        }

        modalStore.getState().openModal({
            // Server-confirmed 401 = the wallet token is authoritatively dead
            // (it may even still be unexpired client-side, e.g. JWT-secret
            // rotation). `reason: "dead"` makes re-auth the primary action and
            // dismissing log out, so the user is never stranded in a session
            // that looks alive but 401s on every request.
            id: "reauth",
            reason: "dead",
        });
    }, [logout]);

    useEffect(() => {
        // On mount and whenever the biometric lock is released, re-evaluate.
        if (!isBiometricLocked) {
            evaluate();
        }
    }, [isBiometricLocked]);

    useEffect(() => {
        // Visibility-change: evaluate when the user returns to the tab.
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                evaluate();
            }
        };
        document.addEventListener("visibilitychange", onVisibility);

        // Coarse interval check.
        const interval = setInterval(evaluate, POLL_INTERVAL_MS);

        // Server-confirmed 401 subscription.
        const unsubscribe = subscribeToWalletAuthExpired(
            handleServerConfirmed401
        );

        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            clearInterval(interval);
            unsubscribe();
        };
    }, [handleServerConfirmed401]);
}

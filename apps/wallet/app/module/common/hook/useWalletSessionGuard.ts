import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
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
function isReauthOpen(): boolean {
    const { modal, stack } = modalStore.getState();
    return modal?.id === "reauth" || stack.some((m) => m.id === "reauth");
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
            expired: true,
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
            // TODO(distant-reauth): a forced logout is a blunt recovery for a
            // paired (distant-webauthn) session. Instead, surface a pairing
            // prompt seeded with the dead session's target authenticatorId /
            // pairingId (e.g. encoded in the pairing QR) so the origin device
            // can re-pair the SAME wallet in one step — a much smoother re-auth
            // than dropping the user back to /register.
            void logout();
            return;
        }

        modalStore.getState().openModal({
            // expired = false: server-confirmed 401 but maybe still in grace
            // window locally. Dismissing should NOT force logout.
            id: "reauth",
            expired: false,
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

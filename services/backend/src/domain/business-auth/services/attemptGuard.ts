import { EMAIL_OTP } from "./EmailOtpService";

/**
 * Per-account failed-attempt lockout for 2FA verification (TOTP + recovery
 * codes, plan §1.8 / M3). The IP-keyed rate limiter is bypassable (rotate the
 * source IP), so a second, identity-keyed gate is needed for the brute-force
 * surface. The email-OTP channel keeps its own row-local counter (it lives on
 * the code row by design) — only the ceiling constant is shared here, so both
 * channels lock after the same number of failures.
 */
export const TWO_FACTOR_LOCKOUT = {
    MAX_ATTEMPTS: EMAIL_OTP.MAX_VERIFY_ATTEMPTS,
    /** Rolling lockout window; matches the email-OTP send window. */
    WINDOW_MS: EMAIL_OTP.SEND_WINDOW_MS,
} as const;

export type AttemptState = {
    attempts: number;
    windowStartedAt: Date | null;
};

/**
 * An elapsed window is treated as reset — the caller never has to eagerly
 * clear it, the counter just starts fresh on the next failure.
 */
function isWindowActive(state: AttemptState, now: number): boolean {
    if (!state.windowStartedAt) return false;
    return now - state.windowStartedAt.getTime() < TWO_FACTOR_LOCKOUT.WINDOW_MS;
}

/** May a new verification attempt proceed given the windowed counter? */
export function isAttemptAllowed(
    state: AttemptState,
    now = Date.now()
): boolean {
    if (!isWindowActive(state, now)) return true;
    return state.attempts < TWO_FACTOR_LOCKOUT.MAX_ATTEMPTS;
}

/** The counter state to persist after a failed attempt. */
export function nextFailureState(
    state: AttemptState,
    now = Date.now()
): AttemptState {
    if (!isWindowActive(state, now)) {
        return { attempts: 1, windowStartedAt: new Date(now) };
    }
    return {
        attempts: state.attempts + 1,
        windowStartedAt: state.windowStartedAt,
    };
}

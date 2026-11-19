import type { RedeemContext } from "@frak-labs/backend-elysia/domain/referral-code/schemas";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { trackEvent } from "../../common/analytics";
import { getErrorCode, resolveApiErrorKey } from "../../common/api/errors";
import { readClipboardText } from "../../common/utils/readClipboardText";
import type { DefaultTranslationKey } from "../../types";
import {
    type RedeemResult,
    useRedeemReferralCode,
} from "./useRedeemReferralCode";

export const REDEMPTION_CODE_LENGTH = 6;

/** Frak holds the referrer slot: the caller confirms before the friend's code replaces it. */
const FRAK_REFERRER_CODE = "FRAK_REFERRER";

const NOT_FOUND_CODE = "NOT_FOUND";

/** What `onUnknownCode` made of the code: an error key replaces the not-found message. */
export type UnknownCodeOutcome =
    | "handled"
    | "unknown"
    | { errorKey: DefaultTranslationKey };

export const REDEEM_ERROR_KEY_MAP = {
    byCode: {
        NOT_FOUND: "wallet.referral.redeem.errorNotFound",
        SELF_REFERRAL: "wallet.referral.redeem.errorSelf",
        WOULD_CYCLE: "wallet.referral.redeem.errorCycle",
        ALREADY_REDEEMED: "wallet.referral.redeem.errorAlreadyRedeemed",
        GAME_CLOSED: "wallet.referral.redeem.errorGameClosed",
    },
    // 400 = domain-level invalid; 422 = Elysia body validation
    // (e.g. user submitted fewer than 6 chars).
    byStatus: {
        400: "wallet.referral.redeem.errorInvalid",
        422: "wallet.referral.redeem.errorInvalid",
    },
    fallback: "wallet.referral.redeem.errorGeneric",
} as const;

type UseRedeemReferralCodeFormOptions = {
    onApplied?: (result: RedeemResult) => void;
    onError?: (errorKey: string) => void;
    /** Require all 6 chars before enabling submit. Default: true. */
    requireCompleteCode?: boolean;
    /** Reset the mutation error when the user edits the code. Default: true. */
    resetErrorOnChange?: boolean;
    /** Pre-fills the field without submitting (URL `?ref=` / install referrer). */
    initialCode?: string;
    /** Forwarded to `/redeem`; only the onboarding step sets it. */
    context?: RedeemContext;
    /** Keeps Frak as referrer without asking: the game join screen, where a code is for joining. */
    keepFrakReferrer?: boolean;
    /** Second chance for a code `/redeem` 404s on, e.g. an install code typed in this field. */
    onUnknownCode?: (code: string) => Promise<UnknownCodeOutcome>;
};

function sanitizeCode(raw: string): string {
    return raw
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, REDEMPTION_CODE_LENGTH)
        .toUpperCase();
}

/**
 * Shared form state + handlers for the referral-code redemption screens.
 * Owns the input value, normalises it (alphanumeric, uppercase, 6 chars),
 * wires the `useRedeemReferralCode` mutation, and resolves the i18n key for
 * any backend error. Parents render their own JSX (button placement, layout
 * and label text differ between the onboarding step and the redeem page).
 */
export function useRedeemReferralCodeForm({
    onApplied,
    onError,
    requireCompleteCode = true,
    resetErrorOnChange = true,
    initialCode,
    context,
    keepFrakReferrer = false,
    onUnknownCode,
}: UseRedeemReferralCodeFormOptions = {}) {
    const [confirmingFrakReplace, setConfirmingFrakReplace] = useState(false);
    const [code, setCode] = useState(() => sanitizeCode(initialCode ?? ""));
    const [isResolvingUnknown, setIsResolvingUnknown] = useState(false);
    const [unknownErrorKey, setUnknownErrorKey] =
        useState<DefaultTranslationKey | null>(null);
    // Bumped by every edit, so a late `onUnknownCode` answer cannot land on a code the user changed.
    const unknownAttemptRef = useRef(0);
    const submittedAttemptRef = useRef(0);

    const clearUnknown = () => {
        unknownAttemptRef.current += 1;
        setIsResolvingUnknown(false);
        setUnknownErrorKey(null);
    };

    const resolveUnknown = async (
        resolver: NonNullable<typeof onUnknownCode>,
        submitted: string,
        error: Error
    ) => {
        const attempt = submittedAttemptRef.current;
        // Edited while `/redeem` was in flight: this 404 answers a code the field does not hold.
        if (attempt !== unknownAttemptRef.current) {
            redeem.reset();
            return;
        }
        setIsResolvingUnknown(true);
        const outcome = await resolver(submitted).catch(
            (): UnknownCodeOutcome => "unknown"
        );
        if (attempt !== unknownAttemptRef.current) return;
        setIsResolvingUnknown(false);
        if (outcome === "handled") {
            setCode("");
            redeem.reset();
            return;
        }
        const key =
            outcome === "unknown"
                ? resolveApiErrorKey(error, REDEEM_ERROR_KEY_MAP)
                : outcome.errorKey;
        if (outcome !== "unknown") setUnknownErrorKey(outcome.errorKey);
        if (key) onError?.(key);
    };

    const redeem = useRedeemReferralCode({
        mutations: {
            onSuccess: (result) => {
                setConfirmingFrakReplace(false);
                onApplied?.(result);
            },
            onError: (error, variables) => {
                const errorCode = getErrorCode(error);
                const asksConfirm = errorCode === FRAK_REFERRER_CODE;
                setConfirmingFrakReplace(asksConfirm);
                if (asksConfirm) {
                    trackEvent("frak_referrer_replace_prompted");
                    return;
                }
                if (onUnknownCode && errorCode === NOT_FOUND_CODE) {
                    resolveUnknown(onUnknownCode, variables.code, error);
                    return;
                }
                const key = resolveApiErrorKey(error, REDEEM_ERROR_KEY_MAP);
                if (key) onError?.(key);
            },
        },
    });

    const isPending = redeem.isPending || isResolvingUnknown;
    const hasValue = code.length > 0;
    const isComplete = code.length === REDEMPTION_CODE_LENGTH;
    const canSubmit =
        (requireCompleteCode ? isComplete : hasValue) && !isPending;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setCode(sanitizeCode(e.target.value));
        clearUnknown();
        if (resetErrorOnChange && redeem.error) redeem.reset();
    };

    const handleClear = () => {
        setCode("");
        clearUnknown();
        redeem.reset();
    };

    /** Resolves `false` when the clipboard is denied; the field stays editable by hand. */
    const handlePaste = async (): Promise<boolean> => {
        try {
            setCode(sanitizeCode(await readClipboardText()));
        } catch {
            return false;
        }
        clearUnknown();
        if (resetErrorOnChange && redeem.error) redeem.reset();
        return true;
    };

    const submit = (replaceFrakReferrer: boolean | undefined) => {
        clearUnknown();
        submittedAttemptRef.current = unknownAttemptRef.current;
        redeem.mutate({ code, context, replaceFrakReferrer });
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        submit(keepFrakReferrer ? false : undefined);
    };

    const confirmFrakReplace = () => {
        trackEvent("frak_referrer_replace_resolved", { outcome: "confirmed" });
        submit(true);
    };

    const cancelFrakReplace = () => {
        trackEvent("frak_referrer_replace_resolved", { outcome: "cancelled" });
        setConfirmingFrakReplace(false);
        redeem.reset();
    };

    const errorMessageKey =
        isResolvingUnknown || getErrorCode(redeem.error) === FRAK_REFERRER_CODE
            ? null
            : (unknownErrorKey ??
              resolveApiErrorKey(redeem.error, REDEEM_ERROR_KEY_MAP));

    return {
        code,
        hasValue,
        isComplete,
        canSubmit,
        isPending,
        errorMessageKey,
        handleChange,
        handleClear,
        handlePaste,
        handleSubmit,
        confirmingFrakReplace,
        confirmFrakReplace,
        cancelFrakReplace,
    };
}

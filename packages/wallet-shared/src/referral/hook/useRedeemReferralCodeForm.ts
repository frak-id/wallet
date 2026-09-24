import type { RedeemContext } from "@frak-labs/backend-elysia/domain/referral-code/schemas";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { resolveApiErrorKey } from "../../common/api/errors";
import { readClipboardText } from "../../common/utils/readClipboardText";
import {
    type RedeemResult,
    useRedeemReferralCode,
} from "./useRedeemReferralCode";

export const REDEMPTION_CODE_LENGTH = 6;

export const REDEEM_ERROR_KEY_MAP = {
    byCode: {
        NOT_FOUND: "wallet.referral.redeem.errorNotFound",
        SELF_REFERRAL: "wallet.referral.redeem.errorSelf",
        WOULD_CYCLE: "wallet.referral.redeem.errorCycle",
        ALREADY_REDEEMED: "wallet.referral.redeem.errorAlreadyRedeemed",
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
}: UseRedeemReferralCodeFormOptions = {}) {
    const redeem = useRedeemReferralCode({
        mutations: {
            onSuccess: (result) => onApplied?.(result),
            onError: (error) => {
                const key = resolveApiErrorKey(error, REDEEM_ERROR_KEY_MAP);
                if (key) onError?.(key);
            },
        },
    });

    const [code, setCode] = useState(() => sanitizeCode(initialCode ?? ""));
    const hasValue = code.length > 0;
    const isComplete = code.length === REDEMPTION_CODE_LENGTH;
    const canSubmit =
        (requireCompleteCode ? isComplete : hasValue) && !redeem.isPending;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setCode(sanitizeCode(e.target.value));
        if (resetErrorOnChange && redeem.error) redeem.reset();
    };

    const handleClear = () => {
        setCode("");
        redeem.reset();
    };

    /** Resolves `false` when the clipboard is denied; the field stays editable by hand. */
    const handlePaste = async (): Promise<boolean> => {
        try {
            setCode(sanitizeCode(await readClipboardText()));
        } catch {
            return false;
        }
        if (resetErrorOnChange && redeem.error) redeem.reset();
        return true;
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit) return;
        redeem.mutate({ code, context });
    };

    const errorMessageKey = resolveApiErrorKey(
        redeem.error,
        REDEEM_ERROR_KEY_MAP
    );

    return {
        code,
        hasValue,
        isComplete,
        canSubmit,
        isPending: redeem.isPending,
        errorMessageKey,
        handleChange,
        handleClear,
        handlePaste,
        handleSubmit,
    };
}

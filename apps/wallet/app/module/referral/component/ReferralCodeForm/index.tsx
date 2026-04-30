import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckCircleFilledIcon,
    CloseIcon,
    SparklesIcon,
} from "@frak-labs/design-system/icons";
import {
    resolveApiErrorKey,
    useIssueReferralCode,
    useReplaceReferralCode,
    useSuggestReferralCodes,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { OrDivider } from "../OrDivider";
import * as styles from "./index.css";

const STEM_PATTERN = /^[a-zA-Z]{4}$/;

/**
 * i18n message keys per backend `HttpError.code`. Backend's `issue`
 * route returns 409 for two distinct conditions — `ALREADY_ACTIVE`
 * (this user already has a code) vs. `CODE_UNAVAILABLE` (the picked
 * suggestion was just claimed by someone else). Map them separately so
 * the user gets actionable guidance instead of a generic conflict.
 */
const ERROR_KEY_MAP = {
    byCode: {
        ALREADY_ACTIVE: "wallet.referral.create.errorAlreadyActive",
        CODE_UNAVAILABLE: "wallet.referral.create.errorCodeUnavailable",
    },
    fallback: "wallet.referral.create.errorGeneric",
} as const;

type ReferralCodeFormProps = {
    /** Called with the issued 6-char code once the backend confirms creation. */
    onIssued?: (code: string) => void;
    /**
     * `"create"` (default) issues a fresh code via `useIssueReferralCode`.
     * `"edit"` rotates the user's active code via `useReplaceReferralCode`
     * (revoke + issue chained).
     */
    mode?: "create" | "edit";
    /**
     * Show the bottom "ou — Générer automatiquement" affordance when the
     * suggestions block isn't visible. Default `true`. The edit-flow sheet
     * sets it to `false` while the auto path doesn't yet support replace
     * mode.
     */
    showAutoGenerate?: boolean;
};

/**
 * Two-stage stem-driven creation form:
 *   - Stage 1 — user types a 4-letter stem and clicks "Générer mon code".
 *     Fetches a suggestion batch from the backend and shows the picker.
 *     The "ou" divider + "Générer automatiquement" pill below jumps to the
 *     dedicated /profile/referral/auto page.
 *   - Stage 2 — suggestions visible. Submit "Valider mon code" → issue the
 *     picked code. Clicking the X on the input rewinds to stage 1.
 */
export function ReferralCodeForm({
    onIssued,
    mode = "create",
    showAutoGenerate = true,
}: ReferralCodeFormProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [stem, setStem] = useState("");
    const [selectedCode, setSelectedCode] = useState<string | null>(null);

    const isValidStem = STEM_PATTERN.test(stem);

    const suggest = useSuggestReferralCodes();
    const suggestions = suggest.data?.suggestions ?? [];
    const hasSuggestions = suggestions.length > 0;

    // The picked branch is stable for the form's lifetime — the parent
    // never flips `mode` mid-render, so calling both `useMutation` hooks
    // and selecting one is safe vs. React's hook-order rules.
    const issueCreate = useIssueReferralCode({
        mutations: {
            onSuccess: ({ code }) => onIssued?.(code),
        },
    });
    const issueReplace = useReplaceReferralCode({
        mutations: {
            onSuccess: ({ code }) => onIssued?.(code),
        },
    });
    const issue = mode === "edit" ? issueReplace : issueCreate;

    const inputValue = selectedCode ?? stem;
    const hasValue = inputValue.length > 0;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (hasSuggestions) return; // input is read-only once suggestions render
        setStem(e.target.value);
    };

    const handleClear = () => {
        setStem("");
        setSelectedCode(null);
        suggest.reset();
        issue.reset();
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (hasSuggestions) {
            // Stage 2: issue the code the user picked.
            if (!selectedCode) return;
            issue.mutate({ code: selectedCode });
        } else {
            // Stage 1: ask the backend for suggestions from the typed stem.
            if (!isValidStem) return;
            suggest.mutate({ stem });
        }
    };

    const handleAutoGenerate = () => {
        navigate({ to: "/profile/referral/auto" });
    };

    const isAnyMutationPending = suggest.isPending || issue.isPending;
    const submitDisabled = hasSuggestions
        ? !selectedCode || isAnyMutationPending
        : !isValidStem || isAnyMutationPending;
    const submitLoading = suggest.isPending || issue.isPending;
    const submitLabel = hasSuggestions
        ? t("wallet.referral.create.submitCta")
        : t("wallet.referral.invite.cta");

    const error = suggest.error ?? issue.error;
    const errorMessageKey = resolveApiErrorKey(error, ERROR_KEY_MAP);

    return (
        <form onSubmit={handleSubmit}>
            <Stack space="m">
                <Stack space="xs">
                    <Box className={styles.labelRow}>
                        <Text
                            as="label"
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("wallet.referral.create.label")}
                        </Text>
                    </Box>
                    <Input
                        variant="bare"
                        length="big"
                        aria-label={t("wallet.referral.create.label")}
                        placeholder={t("wallet.referral.create.placeholder")}
                        autoCapitalize="none"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={inputValue}
                        readOnly={hasSuggestions}
                        onChange={handleChange}
                        rightSection={
                            hasValue ? (
                                <Box
                                    as="button"
                                    type="button"
                                    aria-label={t("common.clear")}
                                    className={styles.clearButton}
                                    onClick={handleClear}
                                >
                                    <CloseIcon />
                                </Box>
                            ) : undefined
                        }
                    />
                    <Box className={styles.hintRow}>
                        <Inline space="xxs" alignY="center">
                            {isValidStem ? (
                                <CheckCircleFilledIcon
                                    width={12}
                                    height={12}
                                    className={styles.checkIcon}
                                />
                            ) : null}
                            <Text variant="caption" color="tertiary">
                                {t("wallet.referral.create.hint")}
                            </Text>
                        </Inline>
                    </Box>
                </Stack>

                {hasSuggestions ? (
                    <Stack space="xs">
                        <Box className={styles.labelRow}>
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("wallet.referral.create.suggestionsLabel")}
                            </Text>
                        </Box>
                        <Box as="div" className={styles.suggestionList}>
                            {suggestions.map((suggestion) => {
                                const isSelected = suggestion === selectedCode;
                                return (
                                    <Box
                                        key={suggestion}
                                        as="button"
                                        type="button"
                                        aria-pressed={isSelected}
                                        className={`${styles.suggestionPill}${
                                            isSelected
                                                ? ` ${styles.suggestionPillSelected}`
                                                : ""
                                        }`}
                                        onClick={() =>
                                            setSelectedCode(suggestion)
                                        }
                                    >
                                        {suggestion}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Stack>
                ) : null}

                <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={submitDisabled}
                    loading={submitLoading}
                >
                    {submitLabel}
                </Button>

                {hasSuggestions || !showAutoGenerate ? null : (
                    <>
                        <OrDivider />
                        <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            width="full"
                            disabled={isAnyMutationPending}
                            onClick={handleAutoGenerate}
                        >
                            {t("wallet.referral.create.autoGenerate")}
                            <SparklesIcon />
                        </Button>
                    </>
                )}

                {errorMessageKey ? (
                    <Text variant="caption" color="error" align="center">
                        {t(errorMessageKey)}
                    </Text>
                ) : null}
            </Stack>
        </form>
    );
}

import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon } from "@frak-labs/design-system/icons";
import {
    getErrorCode,
    resolveApiErrorKey,
    useIssueReferralCode,
    useReplaceReferralCode,
    useSuggestReferralCodes,
} from "@frak-labs/wallet-shared";
import {
    type FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

/** Backend's stem alphabet stripped of digits + ambiguous chars (I, L, O). */
const RANDOM_STEM_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

function generateRandomStem(length = 4): string {
    let stem = "";
    for (let i = 0; i < length; i++) {
        stem += RANDOM_STEM_LETTERS.charAt(
            Math.floor(Math.random() * RANDOM_STEM_LETTERS.length)
        );
    }
    return stem;
}

const ERROR_KEY_MAP = {
    byCode: {
        ALREADY_ACTIVE: "wallet.referral.create.errorAlreadyActive",
        CODE_UNAVAILABLE: "wallet.referral.create.errorCodeUnavailable",
    },
    fallback: "wallet.referral.create.errorGeneric",
} as const;

type Props = {
    /**
     * `"create"` issues a fresh code via `useIssueReferralCode`.
     * `"edit"` rotates the active code via `useReplaceReferralCode`
     * (revoke + issue chained).
     */
    mode: "create" | "edit";
    /** Called with the issued/replaced 6-char code on success. */
    onIssued: (code: string) => void;
    /**
     * Click on "Personnaliser mon code" — the caller decides what happens.
     * Page → navigate to `/profile/referral/create`. Sheet → flip back to
     * the manual view.
     */
    onPersonalize: () => void;
};

/**
 * Reusable body for the auto-generate flow: random stem → suggest →
 * preview the suggestion → confirm via issue (create) or replace (edit).
 *
 * Owns no page chrome — render inside a `ReferralPageShell` (page) or the
 * edit sheet (modal) and let the caller handle redirects/navigation via
 * the `onIssued` / `onPersonalize` callbacks.
 */
export function AutoGenerateReferralCodeBody({
    mode,
    onIssued,
    onPersonalize,
}: Props) {
    const { t } = useTranslation();

    const [autoCode, setAutoCode] = useState<string | null>(null);
    const suggest = useSuggestReferralCodes();

    // `mutateAsync` / `reset` are stable refs in react-query v5, safe to
    // depend on individually instead of the whole mutation object (which
    // re-references on every state change and would noise up the deps).
    const { mutateAsync: suggestMutateAsync, reset: suggestReset } = suggest;

    const fetchAutoCode = useCallback(async () => {
        suggestReset();
        try {
            const result = await suggestMutateAsync({
                stem: generateRandomStem(),
                count: 1,
            });
            if (result.suggestions[0]) {
                setAutoCode(result.suggestions[0]);
            }
        } catch {
            // Surfaced via `suggest.error`.
        }
    }, [suggestMutateAsync, suggestReset]);

    // Both branches' chosen mutation is stable for the body's lifetime —
    // the parent doesn't flip `mode` mid-render — so calling both hooks
    // and selecting one is safe vs. React's hook-order rules.
    const issueCreate = useIssueReferralCode({
        mutations: {
            onSuccess: ({ code }) => onIssued(code),
            onError: (err) => {
                if (getErrorCode(err) === "CODE_UNAVAILABLE") {
                    issueCreate.reset();
                    setAutoCode(null);
                    fetchAutoCode();
                }
            },
        },
    });
    const issueReplace = useReplaceReferralCode({
        mutations: {
            onSuccess: ({ code }) => onIssued(code),
            onError: (err) => {
                if (getErrorCode(err) === "CODE_UNAVAILABLE") {
                    issueReplace.reset();
                    setAutoCode(null);
                    fetchAutoCode();
                }
            },
        },
    });
    const issue = mode === "edit" ? issueReplace : issueCreate;

    // Auto-fetch a single random suggestion on mount. The ref guard
    // prevents StrictMode from firing the request twice in dev.
    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchAutoCode();
    }, [fetchAutoCode]);

    const isLoading = !autoCode && suggest.isPending;
    const isError = !autoCode && !suggest.isPending && !!suggest.error;

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Submit doubles as retry while we're recovering from a failed fetch.
        if (isError) {
            fetchAutoCode();
            return;
        }
        if (!autoCode) return;
        issue.mutate({ code: autoCode });
    };

    const submitLabel = autoCode
        ? t("wallet.referral.create.submitCta")
        : t("wallet.referral.invite.cta");
    const submitDisabled = isLoading || issue.isPending;

    const error = suggest.error ?? issue.error;
    const errorMessageKey = resolveApiErrorKey(error, ERROR_KEY_MAP);

    return (
        <form onSubmit={handleSubmit}>
            <Stack space="m">
                <Stack space="xs">
                    {autoCode ? (
                        <>
                            <Box className={styles.labelRow}>
                                <Text
                                    as="label"
                                    variant="bodySmall"
                                    weight="medium"
                                    color="secondary"
                                >
                                    {t(
                                        "wallet.referral.create.autoConfirmLabel"
                                    )}
                                </Text>
                            </Box>
                            <Input
                                variant="bare"
                                length="big"
                                readOnly
                                value={autoCode}
                                aria-label={t(
                                    "wallet.referral.create.autoConfirmLabel"
                                )}
                                rightSection={
                                    <CheckIcon
                                        width={24}
                                        height={24}
                                        className={styles.checkIcon}
                                    />
                                }
                            />
                        </>
                    ) : isLoading ? (
                        <>
                            <Box
                                className={styles.skeletonInput}
                                aria-busy="true"
                                aria-label={t(
                                    "wallet.referral.create.searchingCode"
                                )}
                            >
                                <Box className={styles.skeletonBar} />
                            </Box>
                            <Box className={styles.hintRow}>
                                <Inline space="xxs" alignY="center">
                                    <Spinner size="s" />
                                    <Text variant="caption" color="tertiary">
                                        {t(
                                            "wallet.referral.create.searchingCode"
                                        )}
                                    </Text>
                                </Inline>
                            </Box>
                        </>
                    ) : null}
                </Stack>

                <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={submitDisabled}
                    loading={issue.isPending}
                >
                    {submitLabel}
                </Button>

                {!isLoading ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        width="full"
                        disabled={issue.isPending}
                        onClick={onPersonalize}
                    >
                        {t("wallet.referral.create.personalizeCta")}
                    </Button>
                ) : null}

                {errorMessageKey ? (
                    <Text variant="caption" color="error" align="center">
                        {t(errorMessageKey)}
                    </Text>
                ) : null}
            </Stack>
        </form>
    );
}

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
    referralKey,
    resolveApiErrorKey,
    useIssueReferralCode,
    useReferralStatus,
    useSuggestReferralCodes,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    type FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ReferralPageShell } from "../ReferralPageShell";
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

export function AutoGenerateReferralCodePage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: status } = useReferralStatus();
    const willRedirectToShare = !!status?.ownedCode;

    useEffect(() => {
        if (willRedirectToShare) {
            navigate({
                to: "/profile/referral/share",
                replace: true,
            });
        }
    }, [willRedirectToShare, navigate]);

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

    const issue = useIssueReferralCode({
        mutations: {
            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: referralKey.status(),
                });
                navigate({
                    to: "/profile/referral/share",
                    replace: true,
                });
            },
            // Self-heal the race window between `suggest` and `issue`: if
            // someone claimed the code in between, drop it and roll a new
            // one so the user isn't retrying the same dead code.
            // ALREADY_ACTIVE self-heals via the status-driven redirect.
            onError: (err) => {
                if (getErrorCode(err) === "CODE_UNAVAILABLE") {
                    issue.reset();
                    setAutoCode(null);
                    fetchAutoCode();
                }
            },
        },
    });

    // Auto-fetch a single random suggestion once status is resolved (so
    // we don't waste a /suggest call on users who already own a code and
    // will be redirected to /share). The ref guard prevents StrictMode
    // from firing the request twice in dev.
    const didFetchRef = useRef(false);
    useEffect(() => {
        if (
            didFetchRef.current ||
            status === undefined ||
            willRedirectToShare
        ) {
            return;
        }
        didFetchRef.current = true;
        fetchAutoCode();
    }, [fetchAutoCode, status, willRedirectToShare]);

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

    const handlePersonalize = () => {
        navigate({ to: "/profile/referral/create" });
    };

    const submitLabel = autoCode
        ? t("wallet.referral.create.submitCta")
        : t("wallet.referral.invite.cta");
    const submitDisabled = isLoading || issue.isPending;

    const error = suggest.error ?? issue.error;
    const errorMessageKey = resolveApiErrorKey(error, ERROR_KEY_MAP);

    return (
        <ReferralPageShell
            backHref="/profile/referral/create"
            title={t("wallet.referral.create.title")}
            description={t("wallet.referral.create.description")}
        >
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
                                        <Text
                                            variant="caption"
                                            color="tertiary"
                                        >
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
                            onClick={handlePersonalize}
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
        </ReferralPageShell>
    );
}

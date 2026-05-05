import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    CheckCircleFilledIcon,
    CloseIcon,
} from "@frak-labs/design-system/icons";
import {
    referralKey,
    resolveApiErrorKey,
    useRedeemReferralCode,
    useReferralStatus,
    useUnredeemReferralCode,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { REDEEMED_CODE_PLACEHOLDER } from "../../constants";
import { DeleteRedemptionConfirmModal } from "../DeleteRedemptionConfirmModal";
import { ReferralPageShell } from "../ReferralPageShell";
import * as styles from "./index.css";

const ERROR_KEY_MAP = {
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

// Unredeem rarely fails (404 means status is already stale; status
// invalidation will reconcile). Anything else falls back to the generic
// message inside the confirm modal.
const UNREDEEM_ERROR_KEY_MAP = {
    fallback: "wallet.referral.redeem.errorGeneric",
} as const;

const REDEMPTION_CODE_LENGTH = 6;

export function RedeemReferralCodePage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const { data: status } = useReferralStatus();
    const referrer = status?.crossMerchantReferrer ?? null;

    const invalidateStatus = () =>
        queryClient.invalidateQueries({ queryKey: referralKey.status() });

    return (
        <ReferralPageShell
            title={t("wallet.referral.redeem.title")}
            description={t("wallet.referral.redeem.description")}
        >
            {status === undefined ? null : referrer ? (
                <ActiveRedemption
                    since={referrer.since}
                    onUnredeemed={invalidateStatus}
                />
            ) : (
                <RedeemForm onRedeemed={invalidateStatus} />
            )}
        </ReferralPageShell>
    );
}

function RedeemForm({ onRedeemed }: { onRedeemed: () => void }) {
    const { t } = useTranslation();
    const redeem = useRedeemReferralCode({
        mutations: { onSuccess: onRedeemed },
    });

    const [code, setCode] = useState("");
    const hasValue = code.length > 0;
    const isCompleteCode = code.length === REDEMPTION_CODE_LENGTH;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, REDEMPTION_CODE_LENGTH)
            .toUpperCase();
        setCode(next);
    };

    const handleClear = () => {
        setCode("");
        redeem.reset();
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isCompleteCode || redeem.isPending) return;
        redeem.mutate({ code });
    };

    const errorMessageKey = resolveApiErrorKey(redeem.error, ERROR_KEY_MAP);

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
                            {t("wallet.referral.redeem.label")}
                        </Text>
                    </Box>
                    <Input
                        variant="bare"
                        length="big"
                        aria-label={t("wallet.referral.redeem.label")}
                        placeholder={t("wallet.referral.redeem.placeholder")}
                        autoCapitalize="characters"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={REDEMPTION_CODE_LENGTH}
                        value={code}
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
                </Stack>
                <Button
                    type="submit"
                    variant="secondary"
                    size="large"
                    width="full"
                    disabled={!isCompleteCode || redeem.isPending}
                    loading={redeem.isPending}
                >
                    {redeem.isPending
                        ? null
                        : t("wallet.referral.redeem.submitCta")}
                </Button>
                {errorMessageKey ? (
                    <Text variant="caption" color="error" align="center">
                        {t(errorMessageKey)}
                    </Text>
                ) : null}
            </Stack>
        </form>
    );
}

function ActiveRedemption({
    since,
    onUnredeemed,
}: {
    since: string;
    onUnredeemed: () => void;
}) {
    const { t, i18n } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const unredeem = useUnredeemReferralCode({
        mutations: {
            onSuccess: () => {
                setConfirmOpen(false);
                onUnredeemed();
            },
        },
    });

    const unredeemErrorKey = resolveApiErrorKey(
        unredeem.error,
        UNREDEEM_ERROR_KEY_MAP
    );

    const handleConfirmOpenChange = (next: boolean) => {
        if (!next) unredeem.reset();
        setConfirmOpen(next);
    };

    const formattedDate = new Intl.DateTimeFormat(i18n.language, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(since));

    return (
        <>
            <Stack space="m">
                <Box className={styles.card}>
                    <Box className={styles.row}>
                        <Text
                            as="span"
                            variant="body"
                            weight="medium"
                            className={styles.codeLabel}
                        >
                            {REDEEMED_CODE_PLACEHOLDER}
                        </Text>
                        <Inline space="xxs" alignY="center">
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="success"
                            >
                                {t("wallet.referral.redeem.active")}
                            </Text>
                            <CheckCircleFilledIcon
                                width={16}
                                height={16}
                                className={styles.activeIcon}
                            />
                        </Inline>
                    </Box>
                    <Box className={styles.row}>
                        <Text
                            as="span"
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                            className={styles.codeLabel}
                        >
                            {t("wallet.referral.redeem.activeSince")}
                        </Text>
                        <Box className={styles.dateValue}>
                            <CalendarIcon
                                width={16}
                                height={16}
                                className={styles.dateIcon}
                            />
                            <Text as="span" variant="bodySmall" weight="medium">
                                {formattedDate}
                            </Text>
                        </Box>
                    </Box>
                </Box>
                <Button
                    type="button"
                    variant="destructive"
                    size="large"
                    width="full"
                    onClick={() => setConfirmOpen(true)}
                >
                    {t("wallet.referral.redeem.deleteCta")}
                </Button>
            </Stack>
            <DeleteRedemptionConfirmModal
                open={confirmOpen}
                onOpenChange={handleConfirmOpenChange}
                onConfirm={() => unredeem.mutate()}
                isPending={unredeem.isPending}
                errorMessageKey={unredeemErrorKey}
            />
        </>
    );
}

import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import {
    CalendarIcon,
    CopyIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    referralKey,
    useCopyToClipboardWithState,
    useReferralStatus,
    useRevokeReferralCode,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReferralPageShell } from "../ReferralPageShell";
import * as styles from "./index.css";

export function ShareReferralCodePage() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: status } = useReferralStatus();
    const ownedCode = status?.ownedCode ?? null;
    const shouldRedirect = status !== undefined && !ownedCode;

    useEffect(() => {
        if (shouldRedirect) {
            navigate({
                to: "/profile/referral/create",
                replace: true,
            });
        }
    }, [shouldRedirect, navigate]);

    const revoke = useRevokeReferralCode({
        mutations: {
            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: referralKey.status(),
                });
                navigate({
                    to: "/profile/referral/create",
                    replace: true,
                });
            },
        },
    });

    const formattedDate = ownedCode
        ? new Intl.DateTimeFormat(i18n.language, {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
          }).format(new Date(ownedCode.createdAt))
        : "";

    const { copied, copy } = useCopyToClipboardWithState();
    // `copied` flips back to false after the hook's internal 2 s timer.
    // We keep the toast mounted ~220 ms longer so its exit animation can play.
    const [showToast, setShowToast] = useState(false);
    useEffect(() => {
        if (copied) {
            setShowToast(true);
            return;
        }
        if (!showToast) return;
        const timeoutId = window.setTimeout(() => setShowToast(false), 220);
        return () => window.clearTimeout(timeoutId);
    }, [copied, showToast]);

    const handleCopy = () => {
        if (!ownedCode) return;
        copy(ownedCode.code);
    };

    const handleShare = async () => {
        if (!ownedCode) return;
        const shareText = t("wallet.referral.share.shareText", {
            code: ownedCode.code,
        });
        // Pass `text` only — combining `title` + `text` makes macOS Safari
        // treat them as two share items ("2 Images") with auto-rendered
        // previews instead of a plain text share.
        if (navigator.share) {
            // Swallow rejections (the user dismissing the share sheet
            // throws AbortError); falling through to `copy()` here would
            // re-fire the "copied" toast they didn't ask for.
            await navigator.share({ text: shareText }).catch(() => {});
            return;
        }
        copy(shareText);
    };

    return (
        <ReferralPageShell
            title={t("wallet.referral.create.title")}
            description={t("wallet.referral.create.description")}
        >
            {showToast ? (
                <ToastSurface>
                    <ConfirmationTooltip isLeaving={!copied}>
                        {t("wallet.referral.share.copiedToast")}
                    </ConfirmationTooltip>
                </ToastSurface>
            ) : null}

            {ownedCode ? (
                <>
                    <Box className={styles.card}>
                        <Box className={styles.row}>
                            <Text
                                as="span"
                                variant="body"
                                weight="medium"
                                className={styles.codeLabel}
                            >
                                {ownedCode.code}
                            </Text>
                            <Box
                                as="button"
                                type="button"
                                aria-label={t("wallet.referral.share.copyCode")}
                                className={styles.copyButton}
                                onClick={handleCopy}
                            >
                                <CopyIcon />
                            </Box>
                        </Box>
                        <Box className={styles.row}>
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                                className={styles.codeLabel}
                            >
                                {t("wallet.referral.share.activeSince")}
                            </Text>
                            <Box className={styles.dateValue}>
                                <CalendarIcon
                                    width={16}
                                    height={16}
                                    className={styles.dateIcon}
                                />
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    weight="medium"
                                >
                                    {formattedDate}
                                </Text>
                            </Box>
                        </Box>
                    </Box>

                    <Stack space="m">
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={handleShare}
                        >
                            {t("wallet.referral.share.shareCta")}
                            <ShareIcon />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            width="full"
                            disabled={revoke.isPending}
                            loading={revoke.isPending}
                            onClick={() => revoke.mutate()}
                        >
                            {t("wallet.referral.share.modifyCta")}
                        </Button>
                    </Stack>
                </>
            ) : null}
        </ReferralPageShell>
    );
}

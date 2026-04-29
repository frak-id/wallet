import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    CopyIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    referralKey,
    useReferralStatus,
    useRevokeReferralCode,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { TermsDisclosure } from "../TermsDisclosure";
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

    const handleCopy = async () => {
        if (!ownedCode) return;
        try {
            await navigator.clipboard.writeText(ownedCode.code);
        } catch {
            // Clipboard unavailable — silently no-op.
        }
    };

    const handleShare = async () => {
        if (!ownedCode) return;
        const shareData = {
            title: t("wallet.referral.create.title"),
            text: t("wallet.referral.share.shareText", {
                code: ownedCode.code,
            }),
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch {
                // User dismissed or share failed; fall through to clipboard.
            }
        }
        try {
            await navigator.clipboard.writeText(shareData.text);
        } catch {
            // Last resort no-op on unsupported environments.
        }
    };

    return (
        <Stack space="m" className={styles.page}>
            <Stack space="m">
                <Back href="/profile/referral" />
                <Title size="page">{t("wallet.referral.create.title")}</Title>
            </Stack>
            <Text variant="body" color="secondary">
                {t("wallet.referral.create.description")}
            </Text>

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

            <Box className={styles.disclosure}>
                <TermsDisclosure />
            </Box>
        </Stack>
    );
}

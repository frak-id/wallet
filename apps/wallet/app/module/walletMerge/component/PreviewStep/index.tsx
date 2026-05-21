import type { MergePreviewResponse } from "@frak-labs/backend-elysia/api/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { WalletCard } from "../WalletCard";
import * as styles from "./index.css";

type PreviewStepProps = {
    preview: MergePreviewResponse;
    /** Email the user just tried to add — surfaced in the recap copy. */
    email: string;
    onContinue: () => void;
    onCancel: () => void;
};

/**
 * Recap step. Shows the two wallets that will be combined, which one stays
 * primary, and a single-line "what you'll gain" tally so the user has a
 * concrete answer to "what does this do to my account?".
 */
export function PreviewStep({
    preview,
    email,
    onContinue,
    onCancel,
}: PreviewStepProps) {
    const { t } = useTranslation();

    const requesterWins =
        preview.winner.toLowerCase() === preview.requesterWallet.toLowerCase();

    const totals = useMemo(
        () => ({
            referralsCount:
                preview.requesterWeight.referralsCount +
                preview.targetWeight.referralsCount,
            interactionsCount:
                preview.requesterWeight.interactionsCount +
                preview.targetWeight.interactionsCount,
            assetsCount:
                preview.requesterWeight.assetsCount +
                preview.targetWeight.assetsCount,
        }),
        [preview.requesterWeight, preview.targetWeight]
    );

    return (
        <PageLayout
            back={<Back onClick={onCancel} />}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onContinue}
                    >
                        {t("wallet.merge.preview.continue")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={onCancel}
                    >
                        {t("wallet.merge.preview.cancel")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("wallet.merge.preview.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.merge.preview.description", { email })}
                    </Text>
                </Stack>

                <Stack space="s">
                    <WalletCard
                        address={preview.requesterWallet}
                        label={t("wallet.merge.preview.labels.thisAccount")}
                        stats={preview.requesterWeight}
                        isWinner={requesterWins}
                    />
                    <Box className={styles.arrow} aria-hidden>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.preview.combineArrow")}
                        </Text>
                    </Box>
                    <WalletCard
                        address={preview.targetWallet}
                        label={t("wallet.merge.preview.labels.otherAccount")}
                        stats={preview.targetWeight}
                        isWinner={!requesterWins}
                    />
                </Stack>

                <Card variant="muted" padding="default">
                    <Stack space="xs">
                        <Text variant="bodySmall" weight="semiBold">
                            {t("wallet.merge.preview.gains.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.preview.gains.description", {
                                referrals: totals.referralsCount,
                                interactions: totals.interactionsCount,
                                assets: totals.assetsCount,
                            })}
                        </Text>
                    </Stack>
                </Card>
            </Stack>
        </PageLayout>
    );
}

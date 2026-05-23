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
import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import { FundsList } from "../FundsList";
import { WalletCard } from "../WalletCard";
import * as styles from "./index.css";

type PreviewStepProps = {
    preview: MergePreviewResponse;
    /** Email the user just tried to add — surfaced in the recap copy. */
    email: string;
    /** Pre-fetched on-chain summary of what the loser holds. Rendered as an
     *  inline "Funds to move" card when non-empty; hidden when empty so the
     *  preview stays tight in the common case. */
    assetSummary: LoserAssetSummary | null | undefined;
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
    assetSummary,
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

    const fundsToMove = assetSummary?.hasFunds ? assetSummary.entries : null;

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

                {fundsToMove && (
                    <Card variant="elevated" padding="default">
                        <Stack space="s">
                            <Stack space="xxs">
                                <Text variant="bodySmall" weight="semiBold">
                                    {t("wallet.merge.preview.funds.title")}
                                </Text>
                                <Text variant="bodySmall" color="secondary">
                                    {t(
                                        "wallet.merge.preview.funds.description"
                                    )}
                                </Text>
                            </Stack>
                            <FundsList entries={fundsToMove} />
                        </Stack>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

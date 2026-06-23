import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { shortenAddress } from "../../utils/shortenAddress";
import * as styles from "./index.css";

type WalletCardProps = {
    address: Address;
    label: string;
    stats: {
        referralsCount: number;
        interactionsCount: number;
        assetsCount: number;
    };
    /**
     * Highlight the card as the winner of the merge. The visual treatment
     * doesn't carry the meaning on its own — the surrounding step text
     * always names which wallet is being kept.
     */
    isWinner?: boolean;
};

/**
 * Compact wallet summary card used inside the merge preview step.
 * Shows the truncated address and the three identity-weight counts the
 * backend uses to pick the winner, so the user understands *why* one side
 * is kept.
 */
export function WalletCard({
    address,
    label,
    stats,
    isWinner = false,
}: WalletCardProps) {
    const { t } = useTranslation();
    return (
        <Card
            padding="default"
            variant={isWinner ? "elevated" : "secondary"}
            className={isWinner ? styles.cardWinner : styles.card}
        >
            <Stack space="s">
                <Box className={styles.header}>
                    <Text variant="bodySmall" color="secondary" weight="medium">
                        {label}
                    </Text>
                    {isWinner && (
                        <Text
                            variant="bodySmall"
                            color="primary"
                            weight="semiBold"
                        >
                            {t("wallet.merge.preview.winnerBadge")}
                        </Text>
                    )}
                </Box>
                <Text variant="body" weight="semiBold">
                    {shortenAddress(address)}
                </Text>
                <Stack space="xs">
                    <StatRow
                        label={t("wallet.merge.preview.stats.referrals")}
                        value={stats.referralsCount}
                    />
                    <StatRow
                        label={t("wallet.merge.preview.stats.interactions")}
                        value={stats.interactionsCount}
                    />
                    <StatRow
                        label={t("wallet.merge.preview.stats.assets")}
                        value={stats.assetsCount}
                    />
                </Stack>
            </Stack>
        </Card>
    );
}

function StatRow({ label, value }: { label: string; value: number }) {
    return (
        <Box className={styles.statRow}>
            <Text variant="bodySmall" color="secondary">
                {label}
            </Text>
            <Text variant="bodySmall" weight="medium">
                {value}
            </Text>
        </Box>
    );
}

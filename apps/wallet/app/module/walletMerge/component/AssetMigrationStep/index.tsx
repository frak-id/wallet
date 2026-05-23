import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { LoserAssetCheckResult } from "../../hook/useLoserAssetCheck";
import { shortenAddress } from "../../utils/shortenAddress";
import * as styles from "./index.css";

type AssetMigrationStepProps = {
    loser: Address;
    winner: Address;
    assets: LoserAssetCheckResult;
    onContinue: () => void;
    onBack: () => void;
};

/**
 * Pre-merge step that warns the user about funds on the account being
 * absorbed. Phase 1 does NOT actually move funds — the dedicated transfer
 * action lands in a later phase — so this step's job is purely to make the
 * trade-off explicit and gate the merge behind an "I understand" checkbox.
 *
 * Two display modes:
 *  - `canCheckLoser` true (the loser wallet is the live session): we list
 *    every non-zero stablecoin balance so the user knows exactly what's at
 *    stake. The "Transfer" CTA is rendered but disabled (Phase 1 placeholder).
 *  - `canCheckLoser` false (the loser is the *other* wallet, we don't have a
 *    JWT for it): a generic warning, no list. The backend balance endpoint
 *    only answers for the JWT owner; Phase 2 will close this gap.
 */
export function AssetMigrationStep({
    loser,
    winner,
    assets,
    onContinue,
    onBack,
}: AssetMigrationStepProps) {
    const { t } = useTranslation();
    const [acknowledged, setAcknowledged] = useState(false);

    const showList = assets.canCheckLoser && !assets.isLoading;
    const hasFunds = showList && assets.hasDetectableFunds;

    return (
        <PageLayout
            back={<Back onClick={onBack} />}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onContinue}
                        disabled={!acknowledged}
                    >
                        {t("wallet.merge.assets.continue")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={onBack}
                    >
                        {t("wallet.merge.assets.back")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("wallet.merge.assets.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.merge.assets.description", {
                            loser: shortenAddress(loser),
                            winner: shortenAddress(winner),
                        })}
                    </Text>
                </Stack>

                {assets.isLoading && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.assets.checking")}
                        </Text>
                    </Card>
                )}

                {showList && hasFunds && assets.stablecoinBalances && (
                    <Card variant="elevated" padding="default">
                        <Stack space="s">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.assets.holdings.title")}
                            </Text>
                            <Stack space="xs">
                                {assets.stablecoinBalances.map((token) => (
                                    <Box
                                        key={token.token}
                                        className={styles.balanceRow}
                                    >
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                        >
                                            {token.symbol}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {formatAmount(token.amount)} (
                                            {formatFiat(token.fiatAmount)})
                                        </Text>
                                    </Box>
                                ))}
                            </Stack>
                        </Stack>
                    </Card>
                )}

                {showList && !hasFunds && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.assets.noFunds")}
                        </Text>
                    </Card>
                )}

                {!assets.canCheckLoser && !assets.isLoading && (
                    <Card variant="muted" padding="default">
                        <Stack space="xs">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.assets.cannotCheck.title")}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t(
                                    "wallet.merge.assets.cannotCheck.description"
                                )}
                            </Text>
                        </Stack>
                    </Card>
                )}

                {hasFunds && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        disabled
                        title={t("wallet.merge.assets.transferDisabledTitle")}
                    >
                        {t("wallet.merge.assets.transferPlaceholder")}
                    </Button>
                )}

                <Box as="label" className={styles.checkboxRow}>
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className={styles.checkboxInput}
                    />
                    <Text variant="bodySmall">
                        {t("wallet.merge.assets.acknowledge")}
                    </Text>
                </Box>
            </Stack>
        </PageLayout>
    );
}

function formatAmount(amount: number): string {
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: 4,
    });
}

function formatFiat(amount: number): string {
    return amount.toLocaleString(undefined, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    });
}

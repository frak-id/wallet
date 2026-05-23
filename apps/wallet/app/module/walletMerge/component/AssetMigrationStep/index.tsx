import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type Address, formatUnits, type Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import type { MigrateLoserAssetsMutation } from "../../strategy/types";
import { shortenAddress } from "../../utils/shortenAddress";
import * as styles from "./index.css";

type AssetMigrationStepProps = {
    loser: Address;
    winner: Address;
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
    /** Pre-fetched summary captured by the preview step. We don't trust it
     *  for the actual submission — the mutation re-reads on entry — but we
     *  use it to decide whether the step renders at all and to populate
     *  the initial recap. */
    summary: LoserAssetSummary | null | undefined;
    migrate: MigrateLoserAssetsMutation;
    onCompleted: () => void;
    onCancel: () => void;
};

/**
 * Pre-settle step that drains the loser smart wallet of its remaining
 * stablecoin balances and pending rewarder claims, moving everything to
 * the winner in a single batched UserOp. Auto-fires on mount — by this
 * point the user has already authorised the addPassKey and the settle
 * step is one tx away, so an extra confirmation buys nothing.
 *
 * On revert / error the user gets a retry CTA. The mutation re-reads the
 * summary on every run, so a stale-read revert (e.g. claimable raced to
 * zero) self-heals on retry. Cancel returns to the home screen via the
 * MergeFlow abort path.
 */
export function AssetMigrationStep({
    loser,
    winner,
    loserAuthenticatorId,
    loserPublicKey,
    summary,
    migrate,
    onCompleted,
    onCancel,
}: AssetMigrationStepProps) {
    const { t } = useTranslation();

    // Idempotency guard for the auto-fire effect: StrictMode + dev would
    // otherwise pump the mutation twice on mount. The mutationKey already
    // dedupes at the React Query layer, but tracking a local flag keeps
    // the intent explicit.
    const startedRef = useRef(false);
    useEffect(() => {
        if (startedRef.current) return;
        if (!summary?.hasFunds) return;
        if (migrate.isPending || migrate.isSuccess || migrate.isError) return;
        startedRef.current = true;
        migrate.mutate(
            {
                loser,
                winner,
                loserAuthenticatorId,
                loserPublicKey,
            },
            { onSuccess: () => onCompleted() }
        );
    }, [
        summary,
        migrate,
        loser,
        winner,
        loserAuthenticatorId,
        loserPublicKey,
        onCompleted,
    ]);

    const retry = () => {
        startedRef.current = true;
        migrate.reset();
        migrate.mutate(
            {
                loser,
                winner,
                loserAuthenticatorId,
                loserPublicKey,
            },
            { onSuccess: () => onCompleted() }
        );
    };

    return (
        <PageLayout
            footer={
                migrate.isError ? (
                    <Box className={styles.footer}>
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={retry}
                        >
                            {t("wallet.merge.migrate.retry")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={onCancel}
                        >
                            {t("wallet.merge.migrate.cancel")}
                        </Button>
                    </Box>
                ) : undefined
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {migrate.isError
                            ? t("wallet.merge.migrate.errorTitle")
                            : t("wallet.merge.migrate.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {migrate.isError
                            ? t("wallet.merge.migrate.errorDescription")
                            : t("wallet.merge.migrate.description", {
                                  winner: shortenAddress(winner),
                              })}
                    </Text>
                </Stack>

                {summary?.hasFunds && (
                    <Card variant="elevated" padding="default">
                        <Stack space="s">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.migrate.holdings.title")}
                            </Text>
                            <Stack space="xs">
                                {summary.entries.map((entry) => (
                                    <Box
                                        key={entry.token}
                                        className={styles.balanceRow}
                                    >
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                        >
                                            {entry.symbol}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {formatAmount(
                                                entry.balance + entry.claimable,
                                                entry.decimals
                                            )}
                                        </Text>
                                    </Box>
                                ))}
                            </Stack>
                        </Stack>
                    </Card>
                )}

                {migrate.isPending && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="status"
                        aria-live="polite"
                    >
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.migrate.pending")}
                        </Text>
                    </Card>
                )}

                {migrate.isError && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="alert"
                        aria-live="assertive"
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.migrate.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

function formatAmount(amount: bigint, decimals: number): string {
    const value = Number(formatUnits(amount, decimals));
    return value.toLocaleString(undefined, {
        maximumFractionDigits: 4,
    });
}

import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Address, Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import type { MigrateLoserAssetsMutation } from "../../strategy/types";
import { FundsList } from "../FundsList";
import * as styles from "./index.css";

type AssetMigrationStepProps = {
    loser: Address;
    winner: Address;
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
    /** Full query handle — we need `data` for the holdings card and the
     *  loading/error/refetch trio to surface a useful screen while the
     *  on-chain summary is still resolving. */
    summary: UseQueryResult<LoserAssetSummary | null, Error>;
    migrate: MigrateLoserAssetsMutation;
    onCompleted: () => void;
    onCancel: () => void;
};

/**
 * Pre-settle step that drains the loser smart wallet of its remaining
 * stablecoin balances and pending rewarder claims, moving everything to
 * the winner in a single batched UserOp.
 *
 * The user explicitly taps "Move my funds" — we deliberately do NOT
 * auto-fire on mount. The previous addPassKey prompt was a system passkey
 * prompt, and stacking another on top with no intermediate user action
 * reads as a double-prompt bug on mobile.
 *
 * The summary query is read here (not just at preview time) so the screen
 * stays useful when its load is slow, fails, or drains to empty between
 * preview and migrate — including the defensive auto-advance to settle
 * when the loser has nothing left to move.
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

    // Defensive auto-advance: if we land here with a fully resolved summary
    // that has no funds (e.g. someone drained the loser between preview and
    // sign), skip the screen instead of stranding the user on a CTA that
    // would no-op. The MergeFlow's branch already tries to skip this step
    // in the same condition; this is the belt-and-braces safety net.
    useEffect(() => {
        if (summary.isLoading || summary.isError) return;
        if (summary.data && !summary.data.hasFunds) onCompleted();
    }, [summary.isLoading, summary.isError, summary.data, onCompleted]);

    const start = useCallback(() => {
        migrate.reset();
        migrate.mutate(
            { loser, winner, loserAuthenticatorId, loserPublicKey },
            { onSuccess: () => onCompleted() }
        );
    }, [
        migrate,
        loser,
        winner,
        loserAuthenticatorId,
        loserPublicKey,
        onCompleted,
    ]);

    // Title + description are state-driven so the screen reads correctly
    // in every state without juggling five JSX branches.
    const { titleKey, descriptionKey } = (() => {
        if (summary.isLoading)
            return {
                titleKey: "wallet.merge.migrate.loadingTitle",
                descriptionKey: "wallet.merge.migrate.loadingDescription",
            };
        if (summary.isError)
            return {
                titleKey: "wallet.merge.migrate.summaryErrorTitle",
                descriptionKey: "wallet.merge.migrate.summaryErrorDescription",
            };
        if (migrate.isError)
            return {
                titleKey: "wallet.merge.migrate.errorTitle",
                descriptionKey: "wallet.merge.migrate.errorDescription",
            };
        if (migrate.isPending)
            return {
                titleKey: "wallet.merge.migrate.title",
                descriptionKey: "wallet.merge.migrate.description",
            };
        // Loaded, with funds, not yet started.
        return {
            titleKey: "wallet.merge.migrate.readyTitle",
            descriptionKey: "wallet.merge.migrate.readyDescription",
        };
    })();

    const showHoldings = !!summary.data?.hasFunds;

    return (
        <PageLayout footer={renderFooter()}>
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t(titleKey)}</Title>
                    <Text variant="body" color="secondary">
                        {t(descriptionKey)}
                    </Text>
                </Stack>

                {summary.isLoading && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="status"
                        aria-live="polite"
                    >
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.migrate.loading")}
                        </Text>
                    </Card>
                )}

                {showHoldings && summary.data && (
                    <Card variant="elevated" padding="default">
                        <Stack space="s">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.migrate.holdings.title")}
                            </Text>
                            <FundsList entries={summary.data.entries} />
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

                {summary.isError && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="alert"
                        aria-live="assertive"
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.migrate.summaryError")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );

    function renderFooter() {
        if (summary.isError) {
            return (
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={() => summary.refetch()}
                    >
                        {t("wallet.merge.migrate.summaryRetry")}
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
            );
        }
        if (migrate.isError) {
            return (
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={start}
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
            );
        }
        if (showHoldings && !migrate.isPending) {
            return (
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={start}
                    >
                        {t("wallet.merge.migrate.start")}
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
            );
        }
        return undefined;
    }
}

import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Address, Hex } from "viem";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import type { MigrateLoserAssetsMutation } from "../../strategy/types";
import { FundsList } from "../FundsList";
import { RemotePeerWaitingCard } from "../RemotePeerWaitingCard";
import * as styles from "../stepLayout.css";

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
    /**
     * Step back to the sign screen. The migrate mutation drains the loser
     * smart wallet, so the back button is disabled while it is in flight
     * to keep the network state predictable.
     */
    onBack: () => void;
    onCancel: () => void;
    /** Optional step indicator rendered in the header center (e.g. "4/5"). */
    stepIndicator?: ReactNode;
    /**
     * `true` when the migrate userOp is routed through the paired mobile
     * (cross-device, desktop=winner): swaps the pending hint for the
     * "approve on your other device" card.
     */
    isPeerSigning?: boolean;
};

/**
 * Pre-settle step draining the loser smart wallet into the winner in a single
 * batched UserOp. The user must tap "Move my funds": auto-firing would stack a
 * second passkey prompt straight after addPassKey, which reads as a
 * double-prompt bug on mobile.
 */
export function AssetMigrationStep({
    loser,
    winner,
    loserAuthenticatorId,
    loserPublicKey,
    summary,
    migrate,
    onCompleted,
    onBack,
    onCancel,
    stepIndicator,
    isPeerSigning = false,
}: AssetMigrationStepProps) {
    const { t } = useTranslation();

    // Auto-advance when the loser was drained between preview and sign, so the
    // user is not stranded on a CTA that would no-op.
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
    const { titleKey, descriptionKey } = ((): {
        titleKey: DefaultTranslationKey;
        descriptionKey: DefaultTranslationKey;
    } => {
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
        <FlowStepScreen
            title={t(titleKey)}
            description={t(descriptionKey)}
            onBack={onBack}
            backDisabled={migrate.isPending}
            stepIndicator={stepIndicator}
            footer={renderFooter()}
        >
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

            {migrate.isPending &&
                (isPeerSigning ? (
                    <RemotePeerWaitingCard />
                ) : (
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
                ))}

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
        </FlowStepScreen>
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

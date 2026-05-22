import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useMergeSettle } from "../../hook/useMergeSettle";
import * as styles from "./index.css";

type SettlingStepProps = {
    loserAuthenticatorId: string;
    onChainTxHash?: Hex;
    loserConsentSignature: string;
    onCompleted: (settle: MergeSettleResponse) => void;
    onCancel: () => void;
};

/**
 * Final off-chain step. No user prompt — delegates the full "wait for the
 * addPassKey receipt then POST `/merge/settle`" pipeline to
 * {@link useMergeSettle}. Surfaces a spinner card while in flight and an
 * actionable retry card on error. All inputs are invariant across retries
 * (the on-chain step already succeeded), so retries re-run the same pipe.
 */
export function SettlingStep({
    loserAuthenticatorId,
    onChainTxHash,
    loserConsentSignature,
    onCompleted,
    onCancel,
}: SettlingStepProps) {
    const { t } = useTranslation();
    const settle = useMergeSettle();
    const startedRef = useRef(false);

    const run = () => {
        settle.mutate(
            {
                loserAuthenticatorId,
                onChainTxHash,
                loserConsentSignature,
            },
            {
                onSuccess: (data) => onCompleted(data),
            }
        );
    };

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        run();
        // Single-shot kick-off on mount. Retries go through the explicit
        // button below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <PageLayout
            footer={
                settle.isError ? (
                    <Box className={styles.footer}>
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={() => run()}
                        >
                            {t("wallet.merge.settling.retry")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={onCancel}
                        >
                            {t("wallet.merge.settling.cancel")}
                        </Button>
                    </Box>
                ) : undefined
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {settle.isError
                            ? t("wallet.merge.settling.errorTitle")
                            : t("wallet.merge.settling.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {settle.isError
                            ? t("wallet.merge.settling.errorDescription")
                            : t("wallet.merge.settling.description")}
                    </Text>
                </Stack>

                {settle.isPending && (
                    <Card variant="muted" padding="default">
                        <Stack space="xs">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.settling.progress.title")}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t("wallet.merge.settling.progress.body")}
                            </Text>
                        </Stack>
                    </Card>
                )}

                {settle.isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.settling.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

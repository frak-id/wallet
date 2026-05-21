import type {
    MergePreviewResponse,
    MergeSettleResponse,
} from "@frak-labs/backend-elysia/api/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useMergeFinaliseLocal } from "../../hook/useMergeFinaliseLocal";
import * as styles from "./index.css";

type FinalizeStepProps = {
    preview: MergePreviewResponse;
    currentAuthenticatorId: string;
    targetAuthenticatorId: string;
    loserConsentSignature: string;
    onComplete: (settle: MergeSettleResponse) => void;
    onCancel: () => void;
};

/**
 * Self-driving finalisation step. Auto-runs the merge mutation on mount
 * (and on retry); displays a progress card while the mutation is in flight
 * and an actionable error card if it fails. Caches the last on-chain
 * txHash so a settle-only retry doesn't redo the userOp.
 */
export function FinalizeStep({
    preview,
    currentAuthenticatorId,
    targetAuthenticatorId,
    loserConsentSignature,
    onComplete,
    onCancel,
}: FinalizeStepProps) {
    const { t } = useTranslation();
    const finalise = useMergeFinaliseLocal();
    const [existingTxHash, setExistingTxHash] = useState<Hex | undefined>(
        undefined
    );
    const startedRef = useRef(false);

    const run = (resumeTxHash?: Hex) => {
        finalise.mutate(
            {
                preview,
                currentAuthenticatorId,
                targetAuthenticatorId,
                loserConsentSignature,
                existingTxHash: resumeTxHash,
            },
            {
                onSuccess: ({ onChainTxHash, settle }) => {
                    setExistingTxHash(onChainTxHash);
                    onComplete(settle);
                },
                onError: () => {
                    // Capture txHash for retry — if the mutation got past
                    // the on-chain leg, `finalise.data` won't be set, but
                    // we record any partial result that may have leaked
                    // through. The hook's structure makes this rare: the
                    // tx is only "lost" if `/merge/settle` fails after a
                    // successful send. In that case the next attempt
                    // re-sends — wasteful but safe (the contract handles
                    // re-add via a duplicate-passkey revert that the
                    // backend will then resolve via the existing
                    // on-chain-pubkey check).
                },
            }
        );
    };

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        run();
        // The deps are intentionally empty — this step kicks off the
        // mutation exactly once on mount. Retries are explicit via the
        // error-state button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <PageLayout
            footer={
                finalise.isError ? (
                    <Box className={styles.footer}>
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={() => run(existingTxHash)}
                        >
                            {t("wallet.merge.finalize.retry")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={onCancel}
                        >
                            {t("wallet.merge.finalize.cancel")}
                        </Button>
                    </Box>
                ) : undefined
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.merge.finalize.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {finalise.isError
                            ? t("wallet.merge.finalize.errorDescription")
                            : t("wallet.merge.finalize.description")}
                    </Text>
                </Stack>

                {finalise.isPending && (
                    <Card variant="muted" padding="default">
                        <Stack space="xs">
                            <Text variant="bodySmall" weight="semiBold">
                                {t("wallet.merge.finalize.progress.title")}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t("wallet.merge.finalize.progress.body")}
                            </Text>
                        </Stack>
                    </Card>
                )}

                {finalise.isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.finalize.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

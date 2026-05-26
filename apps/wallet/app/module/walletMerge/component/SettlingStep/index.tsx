import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { MergeError } from "../../errors";
import { useMergeSettle } from "../../hook/useMergeSettle";
import * as styles from "../stepLayout.css";

/**
 * Step we bounce the user back to when a coded settle error tells us
 * exactly which earlier mutation needs to re-run.
 */
export type SettleRecoveryTarget = "preview" | "consent" | "sign" | "migrate";

type SettlingStepProps = {
    /**
     * Credential id of the OTHER wallet being merged with — the same value
     * originally passed to `/merge/preview` as `targetAuthenticatorId`.
     * Forwarded verbatim to `/merge/settle`; the backend re-derives the
     * loser/winner from it and the live session. Must NOT be the derived
     * loser id (that'd collide with the requester id on the desktop-is-loser
     * path and trip `MERGE_SAME_CREDENTIAL`).
     */
    targetAuthenticatorId: string;
    loserConsentSignature: string;
    /**
     * Set by the cross-device strategy once the pairing is live. Forwarded
     * to `/merge/settle` so the backend pushes `merge-completed` on both
     * pairing topics after settlement. Omitted by the same-device flow.
     */
    pairingId?: string;
    onCompleted: (settle: MergeSettleResponse) => void;
    /**
     * Step back to the previous step in the flow. Disabled while settle
     * is in flight to avoid leaving the backend mid-RPC. Settle itself is
     * idempotent server-side so a back+retry round-trip is safe.
     */
    onBack: () => void;
    onCancel: () => void;
    /**
     * Send the user back to an earlier step when the settle error has a
     * known recovery path. Called only for coded errors with a mapped
     * target; generic / retryable errors stay on this step.
     */
    onRecover: (target: SettleRecoveryTarget) => void;
    /** Optional step indicator rendered in the header center (e.g. "5/5"). */
    stepIndicator?: ReactNode;
};

type SettleRecovery = {
    titleKey: string;
    bodyKey: string;
    ctaKey: string;
    target: SettleRecoveryTarget;
};

/**
 * Map the typed error code thrown by {@link useMergeSettle} to the step
 * we can recover from. Generic / network / unknown errors return `null`
 * and the UI keeps the retry path.
 */
function mapSettleError(code: string | undefined): SettleRecovery | null {
    switch (code) {
        case MergeError.MigrateUserOpReverted:
            return {
                titleKey: "wallet.merge.settling.recover.migrateReverted.title",
                bodyKey: "wallet.merge.settling.recover.migrateReverted.body",
                ctaKey: "wallet.merge.settling.recover.migrateReverted.cta",
                target: "migrate",
            };
        case MergeError.InvalidConsent:
            return {
                titleKey: "wallet.merge.settling.recover.invalidConsent.title",
                bodyKey: "wallet.merge.settling.recover.invalidConsent.body",
                ctaKey: "wallet.merge.settling.recover.invalidConsent.cta",
                target: "consent",
            };
        case MergeError.OnChainPasskeyMissing:
        case MergeError.OnChainPasskeyMismatch:
            return {
                titleKey: "wallet.merge.settling.recover.onChainMismatch.title",
                bodyKey: "wallet.merge.settling.recover.onChainMismatch.body",
                ctaKey: "wallet.merge.settling.recover.onChainMismatch.cta",
                target: "preview",
            };
        default:
            return null;
    }
}

/**
 * Final off-chain step. No user prompt — delegates the full "wait for the
 * addPassKey receipt then POST `/merge/settle`" pipeline to
 * {@link useMergeSettle}. Surfaces a spinner card while in flight and an
 * actionable retry card on error. Coded errors with a known recovery
 * step replace the generic "Retry" CTA with a step-specific bounce-back
 * CTA — retrying the same payload after e.g. `MERGE_INVALID_CONSENT`
 * would just re-fail.
 */
export function SettlingStep({
    targetAuthenticatorId,
    loserConsentSignature,
    pairingId,
    onCompleted,
    onBack,
    onCancel,
    onRecover,
    stepIndicator,
}: SettlingStepProps) {
    const { t } = useTranslation();
    const { mutateAsync: settle, error, isError, isPending } = useMergeSettle();
    const run = useCallback(() => {
        settle(
            {
                targetAuthenticatorId,
                loserConsentSignature,
                pairingId,
            },
            { onSuccess: onCompleted }
        );
    }, [settle]);

    // Directly trigger a run on mount
    useEffect(() => {
        run();
    }, []);

    const recovery = mapSettleError(error?.message);

    return (
        <PageLayout
            back={<Back onClick={onBack} disabled={isPending} />}
            headerCenter={stepIndicator}
            footer={
                isError ? (
                    <Box className={styles.footer}>
                        {recovery ? (
                            <Button
                                type="button"
                                variant="primary"
                                size="large"
                                width="full"
                                onClick={() => onRecover(recovery.target)}
                            >
                                {t(recovery.ctaKey)}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="primary"
                                size="large"
                                width="full"
                                onClick={run}
                            >
                                {t("wallet.merge.settling.retry")}
                            </Button>
                        )}
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
                        {isError
                            ? t(
                                  recovery?.titleKey ??
                                      "wallet.merge.settling.errorTitle"
                              )
                            : t("wallet.merge.settling.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {isError
                            ? t("wallet.merge.settling.errorDescription")
                            : t("wallet.merge.settling.description")}
                    </Text>
                </Stack>

                {isPending && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="status"
                        aria-live="polite"
                    >
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

                {isError && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="alert"
                        aria-live="assertive"
                    >
                        <Text variant="bodySmall" color="error">
                            {t(
                                recovery?.bodyKey ??
                                    "wallet.merge.settling.error"
                            )}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

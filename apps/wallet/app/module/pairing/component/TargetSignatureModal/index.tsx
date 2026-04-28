import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { TargetPairingClient } from "@frak-labs/wallet-shared";
import {
    getTargetPairingClient,
    selectWebauthnSession,
    sessionStore,
    useDeclineSignatureRequest,
    useSignSignatureRequest,
} from "@frak-labs/wallet-shared";
import type { TargetPairingPendingSignature } from "@frak-labs/wallet-shared/pairing/types";
import type { MutationStatus } from "@tanstack/react-query";
import { Check, Shield, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useStore } from "zustand";
import * as styles from "./index.css";

/**
 * Modal that opens automatically whenever the wallet receives a signature
 * request from a paired device, replacing the legacy "signing toast".
 *
 * Behavior:
 *  - Auto-opens on mount or when a new pending signature arrives.
 *  - Always displays the oldest pending request first.
 *  - When multiple are pending, shows a small "1 / N" counter.
 *  - Sign / reject re-uses the existing wallet-shared mutations.
 *  - Dismissing the modal (Escape, click outside, swipe down) keeps the
 *    requests pending and surfaces a prominent banner across all routes.
 *  - Self-gates on a webauthn session — safe to mount at the route root.
 */
export function TargetSignatureModal() {
    const session = sessionStore(selectWebauthnSession);
    if (!session) return null;
    return <InnerTargetSignatureModal />;
}

function InnerTargetSignatureModal() {
    const { t } = useTranslation();
    const client = useMemo(() => getTargetPairingClient(), []);
    const pendingSignatures = useStore(
        client.store,
        (state) => state.pendingSignatures
    );

    const requests = useMemo(
        () => Array.from(pendingSignatures.values()),
        [pendingSignatures]
    );
    const total = requests.length;
    const currentRequest = requests[0];

    const [isDismissed, setIsDismissed] = useState(false);
    const knownIdsRef = useRef<Set<string>>(new Set());

    // Re-open the modal when a NEW signature ID appears. Removals (sign/decline)
    // must NOT reset the dismissed state — otherwise the modal would jump back
    // open while the user explicitly chose to keep it closed.
    useEffect(() => {
        const ids = new Set(requests.map((r) => r.id));
        let hasNew = false;
        for (const id of ids) {
            if (!knownIdsRef.current.has(id)) {
                hasNew = true;
                break;
            }
        }
        knownIdsRef.current = ids;
        if (hasNew) setIsDismissed(false);
    }, [requests]);

    if (total === 0 || !currentRequest) return null;

    return (
        <>
            <ResponsiveModal
                open={!isDismissed}
                onOpenChange={(open) => {
                    if (!open) setIsDismissed(true);
                }}
                title={t("wallet.pairing.signatureRequest.title")}
                description={t("wallet.pairing.signatureRequest.description", {
                    from: currentRequest.from,
                })}
            >
                <SignatureRequestModalContent
                    key={currentRequest.id}
                    request={currentRequest}
                    total={total}
                    client={client}
                />
            </ResponsiveModal>
            {isDismissed && (
                <PendingSignatureBanner
                    count={total}
                    onReview={() => setIsDismissed(false)}
                />
            )}
        </>
    );
}

/**
 * Inner modal content: header (icon + title + counter), description, status
 * indicator, sign / reject actions.
 */
function SignatureRequestModalContent({
    request,
    total,
    client,
}: {
    request: TargetPairingPendingSignature;
    total: number;
    client: TargetPairingClient;
}) {
    const { t } = useTranslation();
    const { mutate: signRequest, status } = useSignSignatureRequest({ client });
    const declineRequest = useDeclineSignatureRequest({ client });
    const [isDeclined, setIsDeclined] = useState(false);
    const isBusy = status === "pending" || status === "success";

    return (
        <Stack space="m" padding="m">
            <Inline alignY="center" align="space-between" space="s">
                <Inline alignY="center" space="xs">
                    <Shield size={20} />
                    <Text variant="heading4" weight="semiBold">
                        {t("wallet.pairing.signatureRequest.title")}
                    </Text>
                </Inline>
                {total > 1 && (
                    <Badge variant="neutral">
                        {t("wallet.pairing.signatureRequest.modal.counter", {
                            current: 1,
                            total,
                        })}
                    </Badge>
                )}
            </Inline>

            <Text>
                <Trans
                    i18nKey="wallet.pairing.signatureRequest.description"
                    values={{ from: request.from }}
                    components={{
                        strongFrom: (
                            <strong className={styles.requestFrom}>
                                {request.from}
                            </strong>
                        ),
                    }}
                />
            </Text>

            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                paddingX="s"
                paddingY="xs"
                backgroundColor="muted"
                borderRadius="s"
            >
                <Text as="span" variant="bodySmall">
                    {t("wallet.pairing.signatureRequest.stateTitle")}
                </Text>
                <SignatureStatusLabel status={status} isDeclined={isDeclined} />
            </Box>

            <Inline space="s" align="space-between" fill>
                <Button
                    variant="secondary"
                    className={styles.rejectButton}
                    onClick={() => {
                        declineRequest(request);
                        setIsDeclined(true);
                    }}
                    disabled={isBusy}
                >
                    {t("wallet.pairing.signatureRequest.buttons.reject")}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => signRequest(request)}
                    disabled={isBusy}
                    loading={status === "pending"}
                >
                    {t("wallet.pairing.signatureRequest.buttons.sign")}
                </Button>
            </Inline>
        </Stack>
    );
}

function SignatureStatusLabel({
    status,
    isDeclined,
}: {
    status: MutationStatus;
    isDeclined: boolean;
}) {
    const { t } = useTranslation();

    if (isDeclined) {
        return (
            <Inline alignY="center" space="xxs">
                <Box as="span" color="error" display="inline-flex">
                    <X size={16} />
                </Box>
                <Text as="span" variant="bodySmall">
                    {t("wallet.pairing.signatureRequest.state.declined")}
                </Text>
            </Inline>
        );
    }

    switch (status) {
        case "pending":
            return (
                <Inline alignY="center" space="xxs">
                    <Spinner size="s" />
                    <Text as="span" variant="bodySmall">
                        {t("wallet.pairing.signatureRequest.state.pending")}
                    </Text>
                </Inline>
            );
        case "success":
            return (
                <Inline alignY="center" space="xxs">
                    <Box as="span" color="success" display="inline-flex">
                        <Check size={16} />
                    </Box>
                    <Text as="span" variant="bodySmall">
                        {t("wallet.pairing.signatureRequest.state.success")}
                    </Text>
                </Inline>
            );
        case "error":
            return (
                <Inline alignY="center" space="xxs">
                    <Box as="span" color="error" display="inline-flex">
                        <X size={16} />
                    </Box>
                    <Text as="span" variant="bodySmall">
                        {t("wallet.pairing.signatureRequest.state.error")}
                    </Text>
                </Inline>
            );
        default:
            return (
                <Text as="span" variant="bodySmall" color="secondary">
                    {t("wallet.pairing.signatureRequest.state.idle")}
                </Text>
            );
    }
}

/**
 * Floating, attention-pulling banner shown across every route while pending
 * signatures exist and the modal is dismissed. Clicking re-opens the modal.
 */
function PendingSignatureBanner({
    count,
    onReview,
}: {
    count: number;
    onReview: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Box
            as="button"
            type="button"
            onClick={onReview}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="s"
            paddingX="m"
            paddingY="s"
            borderRadius="m"
            backgroundColor="primary"
            color="onAction"
            cursor="pointer"
            textAlign="left"
            className={styles.bannerLayout}
            aria-live="polite"
        >
            <Stack space="none">
                <Text variant="bodySmall" weight="semiBold" color="onAction">
                    {t("wallet.pairing.signatureRequest.banner.title")}
                </Text>
                {count > 1 && (
                    <Text variant="caption" color="onAction">
                        {t("wallet.pairing.signatureRequest.banner.summary", {
                            count,
                        })}
                    </Text>
                )}
            </Stack>
            <Box as="span" className={styles.bannerCta}>
                {t("wallet.pairing.signatureRequest.banner.cta")}
            </Box>
        </Box>
    );
}

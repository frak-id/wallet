import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import type { TargetPairingClient } from "@frak-labs/wallet-shared";
import {
    useDeclineSignatureRequest,
    useSignSignatureRequest,
} from "@frak-labs/wallet-shared";
import type { TargetPairingPendingSignature } from "@frak-labs/wallet-shared/pairing/types";
import type { MutationStatus } from "@tanstack/react-query";
import { Check, Shield, X } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

/**
 * List of signature requests
 *
 * @param requests - List of signature requests
 * @param client - Client to send the signature request
 */
export function SignatureRequestList({
    requests,
    client,
}: {
    requests: TargetPairingPendingSignature[];
    client: TargetPairingClient;
}) {
    return requests.map((request) => (
        <SignatureRequest key={request.id} request={request} client={client} />
    ));
}

/**
 * Signature request
 *
 * @param request - Signature request
 * @param client - Client to send the signature request
 */
function SignatureRequest({
    request,
    client,
}: {
    request: TargetPairingPendingSignature;
    client: TargetPairingClient;
}) {
    const { mutate: signRequest, status } = useSignSignatureRequest({ client });
    const declineRequest = useDeclineSignatureRequest({ client });
    const { t } = useTranslation();
    const [isDeclined, setIsDeclined] = useState(false);

    return (
        <Panel size={"small"} className={styles.signatureRequest}>
            <Title icon={<Shield size={24} />}>
                {t("wallet.pairing.signatureRequest.title")}
            </Title>
            <SignatureRequestDescription request={request} />
            <SignatureRequestState status={status} isDeclined={isDeclined} />
            <SignatureRequestActions
                status={status}
                signRequest={() => signRequest(request)}
                declineRequest={() => {
                    declineRequest(request);
                    setIsDeclined(true);
                }}
            />
        </Panel>
    );
}

/**
 * Signature request description
 *
 * @param request - Signature request
 */
function SignatureRequestDescription({
    request,
}: {
    request: TargetPairingPendingSignature;
}) {
    return (
        <Text className={styles.signatureRequestDescription}>
            <Trans
                i18nKey={"wallet.pairing.signatureRequest.description"}
                values={{
                    from: request.from,
                }}
                components={{
                    strongFrom: (
                        <strong className={styles.signatureRequestFrom}>
                            {request.from}
                        </strong>
                    ),
                }}
            />
        </Text>
    );
}

/**
 * Signature request state
 *
 * @param status - Status of the signature request
 */
function SignatureRequestState({
    status,
    isDeclined,
}: {
    status: MutationStatus;
    isDeclined: boolean;
}) {
    const { t } = useTranslation();

    return (
        <Box className={styles.signatureRequestState}>
            <Text as="span" variant="bodySmall">
                {t("wallet.pairing.signatureRequest.stateTitle")}
            </Text>
            <Box as="span">
                <SignatureRequestStateLabel
                    status={status}
                    isDeclined={isDeclined}
                />
            </Box>
        </Box>
    );
}

/**
 * Get the signature request state label
 */
function SignatureRequestStateLabel({
    status,
    isDeclined,
}: {
    status: MutationStatus;
    isDeclined: boolean;
}) {
    const { t } = useTranslation();

    if (isDeclined) {
        return (
            <Box as="span" className={styles.signatureRequestStateLabel}>
                <Box as="span" className={styles.stateLabelError}>
                    <X size={16} />
                </Box>
                {t("wallet.pairing.signatureRequest.state.declined")}
            </Box>
        );
    }

    switch (status) {
        case "pending":
            return (
                <Box as="span" className={styles.signatureRequestStateLabel}>
                    <Spinner size="s" />
                    {t("wallet.pairing.signatureRequest.state.pending")}
                </Box>
            );
        case "success":
            return (
                <Box as="span" className={styles.signatureRequestStateLabel}>
                    <Check size={16} className={styles.stateLabelSuccess} />
                    {t("wallet.pairing.signatureRequest.state.success")}
                </Box>
            );
        case "error":
            return (
                <Box as="span" className={styles.signatureRequestStateLabel}>
                    <X size={16} className={styles.stateLabelError} />
                    {t("wallet.pairing.signatureRequest.state.error")}
                </Box>
            );
        case "idle":
            return (
                <Text as="span" variant="bodySmall">
                    {t("wallet.pairing.signatureRequest.state.idle")}
                </Text>
            );
        default:
            return (
                <Text as="span" variant="bodySmall">
                    {t("wallet.pairing.signatureRequest.state.unknown")}
                </Text>
            );
    }
}

/**
 * Signature request actions
 *
 * @param status - Status of the signature request
 * @param signRequest - Function to sign the signature request
 * @param declineRequest - Function to decline the signature request
 */
function SignatureRequestActions({
    status,
    signRequest,
    declineRequest,
}: {
    status: MutationStatus;
    signRequest: () => void;
    declineRequest: () => void;
}) {
    const { t } = useTranslation();
    const isDisabled = status === "pending" || status === "success";

    return (
        <Box className={styles.signatureRequestButtons}>
            <Button
                variant={"outlined"}
                className={styles.dangerButton}
                onClick={() => declineRequest()}
                type={"button"}
                disabled={isDisabled}
            >
                {t("wallet.pairing.signatureRequest.buttons.reject")}
            </Button>
            <Button
                variant={"primary"}
                onClick={() => signRequest()}
                type={"button"}
                disabled={isDisabled}
            >
                {t("wallet.pairing.signatureRequest.buttons.sign")}
            </Button>
        </Box>
    );
}

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { TargetPairingClient } from "@/module/pairing/clients/target";
import {
    useDeclineSignatureRequest,
    useSignSignatureRequest,
} from "@/module/pairing/hook/useSignSignatureRequest";
import type { TargetPairingPendingSignature } from "@/module/pairing/types";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import type { MutationStatus } from "@tanstack/react-query";
import { Check, Shield, X } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * List of signature requests
 *
 * @param requests - List of signature requests
 * @param client - Client to send the signature request
 */
export function SignatureRequestList({
    requests,
    client,
}: { requests: TargetPairingPendingSignature[]; client: TargetPairingClient }) {
    return (
        <div className={styles.signatureRequestList}>
            {requests.map((request) => (
                <SignatureRequest
                    key={request.id}
                    request={request}
                    client={client}
                />
            ))}
        </div>
    );
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
        <div className={styles.signatureRequest__wrapper}>
            <Panel size={"small"} className={styles.signatureRequest}>
                <Title icon={<Shield size={24} />}>
                    {t("wallet.pairing.signatureRequest.title")}
                </Title>
                <SignatureRequestDescription request={request} />
                <SignatureRequestState
                    status={status}
                    isDeclined={isDeclined}
                />
                <SignatureRequestActions
                    status={status}
                    signRequest={() => signRequest(request)}
                    declineRequest={() => {
                        declineRequest(request);
                        setIsDeclined(true);
                    }}
                />
            </Panel>
        </div>
    );
}

/**
 * Signature request description
 *
 * @param request - Signature request
 */
function SignatureRequestDescription({
    request,
}: { request: TargetPairingPendingSignature }) {
    return (
        <p className={styles.signatureRequest__description}>
            <Trans
                i18nKey={"wallet.pairing.signatureRequest.description"}
                values={{
                    from: request.from,
                }}
                components={{
                    strongFrom: (
                        <strong className={styles.signatureRequest__from}>
                            {request.from}
                        </strong>
                    ),
                }}
            />
        </p>
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
}: { status: MutationStatus; isDeclined: boolean }) {
    const label = getSignatureRequestStateLabel(status, isDeclined);
    const { t } = useTranslation();

    return (
        <div className={styles.signatureRequest__state}>
            <span>{t("wallet.pairing.signatureRequest.stateTitle")}</span>
            <span>{label}</span>
        </div>
    );
}

/**
 * Get the signature request state label
 *
 * @param status - Status of the signature request
 * @param isDeclined - Whether the signature request is declined
 */
function getSignatureRequestStateLabel(
    status: MutationStatus,
    isDeclined: boolean
) {
    const { t } = useTranslation();

    if (isDeclined) {
        return (
            <span className={styles.signatureRequest__stateLabel}>
                <span className={styles.signatureRequest__stateLabelError}>
                    <X size={16} />
                </span>
                {t("wallet.pairing.signatureRequest.state.declined")}
            </span>
        );
    }

    switch (status) {
        case "pending":
            return (
                <span className={styles.signatureRequest__stateLabel}>
                    <Spinner />
                    {t("wallet.pairing.signatureRequest.state.pending")}
                </span>
            );
        case "success":
            return (
                <span className={styles.signatureRequest__stateLabel}>
                    <Check
                        size={16}
                        className={styles.signatureRequest__stateLabelSuccess}
                    />
                    {t("wallet.pairing.signatureRequest.state.success")}
                </span>
            );
        case "error":
            return (
                <span className={styles.signatureRequest__stateLabel}>
                    <X
                        size={16}
                        className={styles.signatureRequest__stateLabelError}
                    />
                    {t("wallet.pairing.signatureRequest.state.error")}
                </span>
            );
        case "idle":
            return t("wallet.pairing.signatureRequest.state.idle");
        default:
            return t("wallet.pairing.signatureRequest.state.unknown");
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

    return (
        <div className={styles.signatureRequest__buttons}>
            <Button
                variant={"danger"}
                size={"small"}
                onClick={() => declineRequest()}
                type={"button"}
                disabled={status === "pending" || status === "success"}
            >
                {t("wallet.pairing.signatureRequest.buttons.reject")}
            </Button>
            <Button
                variant={"primary"}
                size={"small"}
                onClick={() => signRequest()}
                type={"button"}
                disabled={status === "pending" || status === "success"}
            >
                {t("wallet.pairing.signatureRequest.buttons.sign")}
            </Button>
        </div>
    );
}

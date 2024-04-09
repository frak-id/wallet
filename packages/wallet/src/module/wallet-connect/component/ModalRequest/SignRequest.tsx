import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { RequestGenericModal } from "@/module/wallet-connect/component/ModalRequest/Components";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useChainSpecificSmartWallet } from "@/module/wallet/hook/useChainSpecificSmartWallet";
import { FileSignature } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
    type Hex,
    type SignableMessage,
    fromHex,
    isAddress,
    isHex,
} from "viem";

export function SignRequestModal({
    args,
    requestedChainId,
    onHandle,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    requestedChainId: number;
    onHandle: () => void;
}) {
    const { smartWallet } = useChainSpecificSmartWallet({
        chainId: requestedChainId,
    });

    /**
     * Extract the data used for the signature
     */
    const { message, rawMessage } = useMemo(() => {
        const rawParams = args.params.request.params as string[];
        const address = rawParams.find((p) => isAddress(p));
        const rawMessage = rawParams.find((p) => !isAddress(p));

        return {
            address,
            rawMessage,
            message:
                rawMessage && isHex(rawMessage)
                    ? fromHex(rawMessage as Hex, "string")
                    : rawMessage,
        };
    }, [args.params.request.params]);

    /**
     * Check if the approval button should be disabled
     */
    const isApproveDisabled = useMemo(
        () => !(rawMessage && smartWallet?.address),
        [rawMessage, smartWallet]
    );

    /**
     * Get the approval data
     */
    const getApprovalData = useCallback(() => {
        // Ensure we got everything needed
        if (!(smartWallet?.address && rawMessage)) {
            throw new Error("Missing data to sign the message");
        }

        // Sign the message and return the signature as approval data
        const msgPayload: SignableMessage = isHex(rawMessage)
            ? {
                  raw: rawMessage as Hex,
              }
            : rawMessage;
        return smartWallet.signMessage({
            message: msgPayload,
        });
    }, [smartWallet, rawMessage]);

    return (
        <RequestGenericModal
            args={args}
            onHandle={onHandle}
            isApproveDisabled={isApproveDisabled}
            getApprovalData={getApprovalData}
            subtitle={"request a signature"}
            successMessage={"Successfully signed the message"}
        >
            <Panel size={"normal"}>
                <Title icon={<FileSignature />}>Message to sign</Title>
                <br />
                <p className={styles.modalWc__message}>{message}</p>
            </Panel>
        </RequestGenericModal>
    );
}

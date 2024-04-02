import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import {
    WcModal,
    WcModalAction,
    WcModalHeader,
    WcModalRequestContext,
} from "@/module/wallet-connect/component/ModalRequest/index";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { FileSignature } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    type Hex,
    type SignableMessage,
    fromHex,
    isAddress,
    isHex,
} from "viem";

export function SignRequestModal({
    args,
    onClose,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "request" }>;
    onClose: () => void;
}) {
    const { smartWallet } = useWallet();
    const { walletConnectInstance } = useWalletConnect();

    const [isOpen, setIsOpen] = useState(true);

    const close = useCallback(() => {
        setIsOpen(false);
        onClose();
    }, [onClose]);

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
     * Check if the approve button should be disabled
     */
    const isApproveDisabled = useMemo(
        () => !(rawMessage && walletConnectInstance && smartWallet?.address),
        [rawMessage, smartWallet, walletConnectInstance]
    );

    /**
     * Mutation to approve the pairing
     * TODO: Error should be displayed to propose to retry
     */
    const {
        mutate: onApprove,
        isPending: isApproving,
        isSuccess: isApproveInSuccess,
        error: approveError,
    } = useMutation({
        mutationKey: [
            "session-sign-request",
            args.id,
            smartWallet?.address ?? "no-smart-wallet-address",
            rawMessage ?? "no-msg",
        ],
        mutationFn: async () => {
            // Ensure we got everything needed
            if (
                !(
                    walletConnectInstance &&
                    smartWallet?.address &&
                    args.id &&
                    rawMessage
                )
            ) {
                return false;
            }

            // Try to sign the message
            const msgPayload: SignableMessage = isHex(rawMessage)
                ? {
                      raw: rawMessage as Hex,
                  }
                : rawMessage;
            const signature = await smartWallet.signMessage({
                message: msgPayload,
            });

            // Send the signature
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    result: signature,
                },
            });

            // And close the modal after 3 seconds
            setTimeout(close, 3_000);

            return true;
        },
    });

    /**
     * Mutation when the user rejects the pairing
     */
    const { mutate: onReject, isPending: isRejecting } = useMutation({
        mutationKey: ["session-rejection", args.id],
        onMutate: async () => {
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return false;
            }

            // Reject the sign proposal
            await walletConnectInstance.respondSessionRequest({
                topic: args.topic,
                response: {
                    id: args.id,
                    jsonrpc: "2.0",
                    error: {
                        // Code indicating a server error
                        code: -32000,
                        message: getSdkError("USER_REJECTED").message,
                    },
                },
            });

            // And close the modal
            close();

            return true;
        },
    });

    useEffect(() => {
        if (approveError) {
            console.error("Wallet connect session sign error", approveError);
        }
    }, [approveError]);

    const isLoading = useMemo(
        () => isRejecting || isApproving,
        [isRejecting, isApproving]
    );

    return (
        <WcModal
            open={isOpen}
            onOpenChange={(value) => {
                if (value === false) {
                    onReject();
                }
            }}
        >
            <WcModalHeader
                metadata={args.session.peer.metadata}
                verifyContext={args.verifyContext}
                subTitle={"request a signature"}
            />

            <WcModalRequestContext
                chain={args.params.chainId}
                protocol={args.session.relay.protocol}
            />

            {/*Format this stuff, maybe small panel for each parts? */}
            <Panel size={"normal"}>
                <Title icon={<FileSignature />}>Message to sign</Title>
                {message}
            </Panel>

            {approveError && (
                <p className={`error ${styles.modalPairing__error}`}>
                    {approveError.message}
                </p>
            )}

            {isApproveInSuccess ? (
                <p className={styles.modalPairing__success}>
                    Successfully signed the payload
                </p>
            ) : (
                <WcModalAction
                    isLoading={isLoading}
                    isApproveDisabled={isApproveDisabled}
                    onApprove={onApprove}
                    onReject={onReject}
                />
            )}
        </WcModal>
    );
}

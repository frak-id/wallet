import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import {
    WcModalAction,
    WcModalHeader,
} from "@/module/wallet-connect/component/ModalRequest/Components";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useChainSpecificSmartWallet } from "@/module/wallet/hook/useChainSpecificSmartWallet";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { FileSignature } from "lucide-react";
import { useMemo } from "react";
import { useChainId } from "wagmi";

export function AuthRequestModal({
    args,
    onHandle,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "auth" }>;
    onHandle: () => void;
}) {
    const chainId = useChainId();
    const { walletConnectInstance } = useWalletConnect();

    /**
     * Extract the request chain id
     */
    const requestedChainId = useMemo(() => {
        const rawchainId = args.params.cacaoPayload.chainId?.replace(
            "eip155:",
            ""
        );
        return rawchainId ? Number.parseInt(rawchainId) : undefined;
    }, [args.params.cacaoPayload.chainId]);

    const { smartWallet } = useChainSpecificSmartWallet({
        chainId: requestedChainId,
    });

    /**
     * The iss that will be used for the auth request
     */
    const iss = useMemo(
        () =>
            `did:pkh:eip155:${requestedChainId ?? chainId}:${
                smartWallet?.address
            }`,
        [smartWallet?.address, requestedChainId, chainId]
    );

    /**
     * The message payload to sign
     */
    const message = useMemo(
        () =>
            walletConnectInstance?.formatMessage(args.params.cacaoPayload, iss),
        [args.params.cacaoPayload, walletConnectInstance, iss]
    );

    /**
     * Extract few mandatory stuff from the args
     */
    const metadata = useMemo(
        () => args.params.requester.metadata,
        [args.params.requester.metadata]
    );

    /**
     * Check if the approval button should be disabled
     */
    const isApproveDisabled = useMemo(
        () => !(walletConnectInstance && smartWallet?.address && message),
        [smartWallet, walletConnectInstance, message]
    );

    /**
     * Mutation to approve the pairing
     */
    const {
        mutate: onApprove,
        isPending: isApproving,
        isSuccess: isApproveInSuccess,
        error: approveError,
    } = useMutation({
        mutationKey: [
            "authentication-approval",
            args.id,
            smartWallet?.address ?? "no-smart-wallet-address",
            message,
        ],
        mutationFn: async () => {
            console.log("Approving authentication", { args });
            // Ensure we got everything needed
            if (
                !(
                    walletConnectInstance &&
                    smartWallet?.address &&
                    args.id &&
                    message
                )
            ) {
                return;
            }

            // Perform the signature
            const signature = await smartWallet.signMessage({
                message,
            });

            // Approve the authentication request
            await walletConnectInstance.respondAuthRequest(
                {
                    id: args.id,
                    signature: {
                        s: signature,
                        t: "eip1271",
                    },
                },
                iss
            );

            // And close the modal after 3 seconds
            setTimeout(onHandle, 3_000);
        },
    });

    /**
     * Mutation when the user rejects the pairing
     */
    const { mutate: onReject, isPending: isRejecting } = useMutation({
        mutationKey: ["authentication-rejection", args.id],
        onMutate: async () => {
            console.log("Rejecting pairing");
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return;
            }

            await walletConnectInstance.respondAuthRequest(
                {
                    id: args.id,
                    error: getSdkError("USER_REJECTED"),
                },
                iss
            );

            // And close the modal
            onHandle();
        },
    });

    const isLoading = useMemo(
        () => isRejecting || isApproving,
        [isRejecting, isApproving]
    );

    return (
        <>
            <WcModalHeader metadata={metadata} subTitle={"wants to connect"} />

            <Panel size={"normal"}>
                <Title icon={<FileSignature />}>
                    Message to sign to validate authentication
                </Title>
                <br />
                <p className={styles.modalWc__message}>{message}</p>
            </Panel>

            {isApproveInSuccess ? (
                <p className={styles.modalPairing__success}>
                    Connection successful to {metadata.name}
                </p>
            ) : (
                <WcModalAction
                    isLoading={isLoading}
                    isApproveDisabled={isApproveDisabled}
                    onApprove={onApprove}
                    onReject={onReject}
                />
            )}

            {approveError && (
                <p className={`error ${styles.modalPairing__error}`}>
                    {approveError.message}
                </p>
            )}
        </>
    );
}

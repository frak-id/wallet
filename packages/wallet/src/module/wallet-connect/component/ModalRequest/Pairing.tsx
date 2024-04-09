import { getNamespaces } from "@/context/wallet-connect/namespace";
import { checkRequestedChain } from "@/context/wallet-connect/pairing";
import {
    WcModalAction,
    WcModalHeader,
} from "@/module/wallet-connect/component/ModalRequest/Components";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useInvalidateWalletConnectSessions } from "@/module/wallet-connect/hook/useWalletConnectSessions";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { useMemo } from "react";

export function PairingModal({
    args,
    onHandle,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "pairing" }>;
    onHandle: () => void;
}) {
    const { smartWallet } = useWallet();
    const { walletConnectInstance } = useWalletConnect();
    const invalidateWalletConnectSessions =
        useInvalidateWalletConnectSessions();

    /**
     * Extract few mandatory stuff from the args
     */
    const {
        proposer: { metadata },
        requiredNamespaces,
        optionalNamespaces,
    } = useMemo(() => args.params, [args.params]);

    /**
     * All the chain requested not supported
     *   - TODO: Maybe filter for only the required not supported to throw an error
     *   - TODO: Display the optional one not supported as warning
     */
    const {
        supported: _supportedChains,
        requiredMissing: requiredChainsMissing,
        optionalMissing: _optionalChainsMissing,
    } = useMemo(
        () => checkRequestedChain(requiredNamespaces, optionalNamespaces),
        [requiredNamespaces, optionalNamespaces]
    );

    /**
     * Check if the approve button should be disabled
     */
    const isApproveDisabled = useMemo(
        () =>
            requiredChainsMissing.length > 0 ||
            !walletConnectInstance ||
            !smartWallet?.address,
        [requiredChainsMissing, smartWallet, walletConnectInstance]
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
            "session-approval",
            args.id,
            smartWallet?.address ?? "no-smart-wallet-address",
        ],
        mutationFn: async () => {
            console.log("Approving pairing");
            // Ensure we got everything needed
            if (!(walletConnectInstance && smartWallet?.address && args.id)) {
                return;
            }

            // Try to approve the pairing
            try {
                // Approve session proposal, use id from session proposal event and respond with namespace(s) that satisfy dapps request and contain approved accounts
                const namespaces = getNamespaces(
                    args.params,
                    smartWallet.address
                );
                await walletConnectInstance.approveSession({
                    id: args.id,
                    namespaces,
                });
            } catch (error) {
                console.error("Wallet connect session proposal error", {
                    error,
                });
                // Reject the session proposal because of the error
                await walletConnectInstance.rejectSession({
                    id: args.id,
                    reason: getSdkError("SESSION_SETTLEMENT_FAILED"),
                });
            }

            // And close the modal after 3 seconds
            setTimeout(onHandle, 3_000);

            // Once we are here, refresh the sessions
            await invalidateWalletConnectSessions();
        },
    });

    /**
     * Mutation when the user rejects the pairing
     */
    const { mutate: onReject, isPending: isRejecting } = useMutation({
        mutationKey: ["session-rejection", args.id],
        onMutate: async () => {
            console.log("Rejecting pairing");
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return;
            }

            // TODO: Change the error if networks not supported?

            await walletConnectInstance.rejectSession({
                id: args.id,
                reason: getSdkError("USER_REJECTED"),
            });

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
            <WcModalHeader
                metadata={metadata}
                verifyContext={args.verifyContext}
                subTitle={"wants to connect"}
            />

            {requiredChainsMissing.length > 0 && (
                <p className={`error ${styles.modalPairing__error}`}>
                    Networks not supported:
                    <br />
                    {requiredChainsMissing.join(", ")}
                </p>
            )}

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

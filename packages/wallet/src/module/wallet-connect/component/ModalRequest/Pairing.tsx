import { getNamespaces } from "@/context/wallet-connect/namespace";
import { checkRequestedChain } from "@/context/wallet-connect/pairing";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/component/EventsWalletConnect";
import {
    WcModal,
    WcModalAction,
    WcModalHeader,
} from "@/module/wallet-connect/component/ModalRequest/Components";
import styles from "@/module/wallet-connect/component/ModalRequest/index.module.css";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { getSdkError } from "@walletconnect/utils";
import { useCallback, useMemo, useState } from "react";

export function PairingModal({
    args,
    onClose,
}: {
    args: Extract<WalletConnectRequestArgs, { type: "pairing" }>;
    onClose: () => void;
}) {
    const { smartWallet } = useWallet();
    const { walletConnectInstance, refreshSessions } = useWalletConnect();

    const [isOpen, setIsOpen] = useState(true);

    const close = useCallback(() => {
        setIsOpen(false);
        onClose();
    }, [onClose]);

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
                return false;
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

            // Once we are here, refresh the sessions
            await refreshSessions();

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
            console.log("Rejecting pairing");
            // Ensure we got everything needed
            if (!(walletConnectInstance && args.id)) {
                return false;
            }

            // TODO: Change the error if networks not supported?

            await walletConnectInstance.rejectSession({
                id: args.id,
                reason: getSdkError("USER_REJECTED"),
            });

            // And close the modal
            close();

            return true;
        },
    });

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
        </WcModal>
    );
}

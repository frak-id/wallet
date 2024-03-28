"use client";

import { ModalPairing } from "@/module/wallet-connect/component/ModalPairing";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

export function EventsWalletConnect({ children }: PropsWithChildren) {
    const { walletConnectInstance, refreshSessions } = useWalletConnect();
    const [pairing, setPairing] = useState<boolean>(false);
    const [pairingData, setPairingData] = useState<
        Web3WalletTypes.SessionProposal | undefined
    >(undefined);

    async function onSessionProposal({
        id,
        params,
        verifyContext,
    }: Web3WalletTypes.SessionProposal) {
        console.log("Wallet connect session proposal", {
            id,
            params,
            verifyContext,
        });
        if (!walletConnectInstance) return;
        setPairingData({ id, params, verifyContext });
        setPairing(true);
    }

    async function onProposalExpire({ id }: Web3WalletTypes.ProposalExpire) {
        console.log("Wallet connect proposal expire", { id });
        if (!walletConnectInstance) return;
        if (pairingData?.id !== id) return;
        setPairingData(undefined);
        setPairing(false);
        // TODO: Check expiration logic
    }

    async function onSessionDelete({
        id,
        topic,
    }: Web3WalletTypes.SessionDelete) {
        console.log("Wallet connect session delete", { id, topic });
        if (!walletConnectInstance) return;
        await refreshSessions();
    }

    useEffect(() => {
        if (!walletConnectInstance) return;
        walletConnectInstance.on("session_proposal", onSessionProposal);
        walletConnectInstance.on("proposal_expire", onProposalExpire);
        walletConnectInstance.on("session_request", (proposal) => {
            console.log("Wallet connect session request", { proposal });
        });
        walletConnectInstance.on("auth_request", (proposal) => {
            console.log("Wallet connect auth request", { proposal });
        });
        walletConnectInstance.on("session_delete", onSessionDelete);

        return () => {
            walletConnectInstance.off("session_proposal", onSessionProposal);
            walletConnectInstance.off("proposal_expire", onProposalExpire);
            walletConnectInstance.off("session_delete", onSessionDelete);
        };
    }, [walletConnectInstance]);

    /**
     * Reset pairing data when pairing is closed
     */
    useEffect(() => {
        if (!pairing) {
            setPairingData(undefined);
        }
    }, [pairing]);

    return (
        <>
            {pairing && pairingData && (
                <ModalPairing
                    id={pairingData.id}
                    params={pairingData.params}
                    verifyContext={pairingData.verifyContext}
                    open={pairing}
                    onOpenChange={setPairing}
                />
            )}
            {children}
        </>
    );
}

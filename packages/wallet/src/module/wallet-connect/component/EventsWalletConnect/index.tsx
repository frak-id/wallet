"use client";

import { ModalPairing } from "@/module/wallet-connect/component/ModalPairing";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import type { ProposalTypes } from "@walletconnect/types";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { type PropsWithChildren, useEffect, useState } from "react";

export function EventsWalletConnect({ children }: PropsWithChildren) {
    const { walletConnectInstance } = useWalletConnect();
    const [pairing, setPairing] = useState<boolean>(false);
    const [pairingData, setPairingData] = useState<
        | {
              id: number;
              params: ProposalTypes.Struct;
          }
        | undefined
    >(undefined);

    async function onSessionProposal({
        id,
        params,
    }: Web3WalletTypes.SessionProposal) {
        console.log("Wallet connect session proposal", { id, params });
        if (!walletConnectInstance) return;
        setPairingData({ id, params });
        setPairing(true);
    }

    useEffect(() => {
        if (!walletConnectInstance) return;
        walletConnectInstance.on("session_proposal", onSessionProposal);
        // walletConnectInstance.on("session_request", (proposal) => {
        //     console.log("Wallet connect session request", { proposal });
        // });
        // walletConnectInstance.on("auth_request", (proposal) => {
        //     console.log("Wallet connect auth request", { proposal });
        // });
        // walletConnectInstance.on("session_delete", (proposal) => {
        //     console.log("Wallet connect session delete", { proposal });
        // });

        return () => {
            walletConnectInstance.off("session_proposal", onSessionProposal);
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
                    open={pairing}
                    onOpenChange={setPairing}
                />
            )}
            {children}
        </>
    );
}

import {
    type FrakWalletConnector,
    smartAccountConnector,
} from "@/context/wallet/smartWallet/connector";
import {
    ecdsaSessionAtom,
    sdkSessionAtom,
    sessionAtom,
} from "@/module/common/atoms/session";
import type { PrivyContextType } from "@/module/common/provider/PrivyProvider";
import { jotaiStore } from "@module/atoms/store";
import { useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import { useCallback, useEffect, useMemo } from "react";
import { type Address, type Hex, isAddressEqual, zeroAddress } from "viem";
import { useConfig } from "wagmi";

/**
 * Hook that synchronise the dynamic session
 */
export function useSyncEcdsaSession({
    ready,
    wallet,
    signMessage,
}: PrivyContextType) {
    const ecdsaSession = useAtomValue(ecdsaSessionAtom);
    const { connectors } = useConfig();

    /**
     * Extract the frak connector
     */
    const frakConnector = useMemo(
        () =>
            connectors.find(
                (connector) => connector.type === smartAccountConnector.type
            ),
        [connectors]
    );

    /**
     * Synchronise the session with the ecdsa session
     */
    useEffect(() => {
        if (!ecdsaSession) return;
        if (!ready) return;

        // If the addresses doesn't match, early reset
        if (!isAddressEqual(wallet ?? zeroAddress, ecdsaSession.publicKey)) {
            jotaiStore.set(sessionAtom, RESET);
            jotaiStore.set(sdkSessionAtom, RESET);
            return;
        }

        // Otherwise, nothing to do
    }, [ecdsaSession, ready, wallet]);

    /**
     * Build the privy signer that will be used inside the connector
     */
    const privySigner = useCallback(
        ({ hash, address }: { hash: Hex; address: Address }) => {
            if (!ready) throw new Error("Privy not ready");

            return signMessage({ hash, address });
        },
        [ready, signMessage]
    );

    useEffect(() => {
        if (!frakConnector) return;

        (frakConnector as unknown as FrakWalletConnector).setPrivySigner(
            privySigner
        );
    }, [frakConnector, privySigner]);
}

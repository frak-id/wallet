import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { decodeJwt } from "jose";
import { useEffect, useMemo } from "react";
import { type Address, type Hex, isAddressEqual } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useConfig, useConnect } from "wagmi";
import {
    type FrakWalletConnector,
    smartAccountConnector,
} from "@/module/wallet/smartWallet/connector";
import { getFromLocalStorage } from "../../listener/utils/localStorage";
import {
    demoPrivateKeyAtom,
    type SdkSessionPayload,
    sdkSessionAtom,
} from "../atoms/session";

/**
 * Hook that enforce wagmi connection
 */
export function useEnforceWagmiConnection() {
    /**
     * Get the current wagmi state
     */
    const { state, connectors } = useConfig();

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
     * Connect to the frak connector
     */
    const { connect, isPending } = useConnect();

    useEffect(() => {
        // If we are not disconnected, early exit
        if (
            state.status !== "disconnected" &&
            state.current === frakConnector?.uid
        ) {
            return;
        }

        // If we are currently connecting, do nothing
        if (isPending) {
            return;
        }

        // If the frak connector isn't found, do nothing
        if (!frakConnector) {
            return;
        }

        // And then connect to it
        console.log("Manually connecting to frak wallet connector", {
            status: state.status,
            current: state.current,
        });
        connect({ connector: frakConnector });
    }, [connect, frakConnector, isPending, state.current, state.status]);

    /**
     * Update the ecdsa signer
     */
    useEffect(() => {
        if (!frakConnector) {
            return;
        }

        (frakConnector as unknown as FrakWalletConnector).setEcdsaSigner(
            ({ hash, address }: { hash: Hex; address: Address }) => {
                const sdkSession = jotaiStore.get(sdkSessionAtom);
                const parsedSession = sdkSession
                    ? decodeJwt<SdkSessionPayload>(sdkSession.token)
                    : undefined;

                // Get the potential pkeys
                const potentialPkeys = [
                    jotaiStore.get(demoPrivateKeyAtom) ??
                        getFromLocalStorage<Hex>("frak_demoPrivateKey"),
                    parsedSession?.additionalData?.demoPkey,
                ];

                // Try to find a valid pkey
                for (const pkey of potentialPkeys) {
                    if (!pkey) {
                        continue;
                    }

                    // Parse the account
                    const account = privateKeyToAccount(pkey);
                    if (!isAddressEqual(account.address, address)) {
                        continue;
                    }

                    // Sign the message
                    return account.signMessage({ message: { raw: hash } });
                }
                console.warn("No valid pkey found", {
                    potentialAddresses: potentialPkeys.map((pkey) =>
                        pkey ? privateKeyToAccount(pkey).address : "undefined"
                    ),
                    address,
                });

                throw new Error("No valid pkey found");
            }
        );
    }, [frakConnector]);
}

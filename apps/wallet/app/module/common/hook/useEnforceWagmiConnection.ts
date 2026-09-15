import type { SdkSessionPayload } from "@frak-labs/wallet-shared";
import {
    type FrakWalletConnector,
    getFromLocalStorage,
    sessionStore,
    smartAccountConnector,
} from "@frak-labs/wallet-shared";
import { decodeJwt } from "jose";
import { useEffect, useMemo } from "react";
import { type Address, type Hex, isAddressEqual } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { useConfig, useConnect } from "wagmi";

export function useEnforceWagmiConnection() {
    const { state, connectors } = useConfig();

    const frakConnector = useMemo(
        () =>
            connectors.find(
                (connector) => connector.type === smartAccountConnector.type
            ),
        [connectors]
    );

    const { mutate: connect, isPending } = useConnect();

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
        connect({ connector: frakConnector });
    }, [connect, frakConnector, isPending, state.current, state.status]);

    useEffect(() => {
        if (!frakConnector) {
            return;
        }

        (frakConnector as unknown as FrakWalletConnector).setEcdsaSigner(
            ({ hash, address }: { hash: Hex; address: Address }) => {
                const sdkSession = sessionStore.getState().sdkSession;
                const parsedSession = sdkSession
                    ? decodeJwt<SdkSessionPayload>(sdkSession.token)
                    : undefined;

                // Get the potential pkeys
                const potentialPkeys = [
                    sessionStore.getState().demoPrivateKey ??
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
                throw new Error("No valid pkey found");
            }
        );
    }, [frakConnector]);
}

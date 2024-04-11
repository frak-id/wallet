import { getSignOptions } from "@/context/wallet/action/sign";
import { webAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { startAuthentication } from "@simplewebauthn/browser";
import { getClient } from "@wagmi/core";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { useCallback, useMemo } from "react";
import { http, type Chain, createClient } from "viem";
import type { Config } from "wagmi";

/**
 * Hook used to get the smart account connector
 * @param config
 * @param session
 */
export function useSmartWalletConnector({
    config,
    wallet,
}: { config: Config; wallet?: WebAuthNWallet }) {
    /**
     * Function used to get our AA clients
     */
    const getAaClient = useCallback((chain: Chain) => {
        // Build the pimlico bundler transport and client
        const bundlerTransport = http(
            `https://api.pimlico.io/v1/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        );
        const bundlerClient = createClient({
            chain,
            transport: bundlerTransport,
        });

        // If the chain isn't a testnet, exit without paymaster as default
        if (chain.testnet !== true) {
            return {
                bundlerTransport,
                bundlerClient,
                paymasterClient: undefined,
            };
        }

        // Build the pimlico paymaster client
        const paymasterClient = createClient({
            chain,
            transport: http(
                `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
            ),
        });

        return {
            bundlerTransport,
            bundlerClient,
            paymasterClient,
        };
    }, []);

    /**
     * Function used to build a smart wallet client
     */
    const buildSmartWalletClient = useCallback(
        async (chainId: number) => {
            // Get the viem client
            const viemClient = getClient(config, { chainId });
            if (!viemClient) {
                throw new Error("No viem client found");
            }
            if (!wallet) {
                throw new Error("No wallet found");
            }

            // Get the smart wallet client
            const { authenticatorId, publicKey } = wallet;

            // Then build the smart account
            const smartAccount = await webAuthNSmartAccount(viemClient, {
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                authenticatorId,
                signerPubKey: publicKey,
                signatureProvider: async (message) => {
                    // Get the signature options from server
                    const options = await getSignOptions({
                        authenticatorId,
                        toSign: message,
                    });

                    // Start the client authentication
                    const authenticationResponse =
                        await startAuthentication(options);

                    // Perform the verification of the signature
                    return parseWebAuthNAuthentication(authenticationResponse);
                },
            });

            // Get the aa clients
            const { bundlerTransport, paymasterClient } = getAaClient(
                viemClient.chain
            );

            // Build the smart wallet client
            return createSmartAccountClient({
                account: smartAccount,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chain: viemClient.chain,
                bundlerTransport,
                // Only add a middleware if the paymaster client is available
                middleware: paymasterClient
                    ? {
                          sponsorUserOperation: (args) =>
                              sponsorUserOperation(paymasterClient, args),
                      }
                    : {},
            });
        },
        [wallet, config, getAaClient]
    );

    /**
     * Return the smart account connector
     */
    return useMemo(
        () =>
            smartAccountConnector({
                smartAccountClientBuilder: async ({ chainId }) => {
                    return await buildSmartWalletClient(chainId);
                },
            }),
        [buildSmartWalletClient]
    );
}

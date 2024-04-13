import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/common/blockchain/aa-provider";
import { getAlchemyTransport } from "@/context/common/blockchain/alchemy-transport";
import {
    type AvailableChainIds,
    availableChains,
} from "@/context/common/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import { webAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { sessionAtom } from "@/module/common/atoms/session";
import { startAuthentication } from "@simplewebauthn/browser";
import { atom } from "jotai/index";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { createClient, extractChain } from "viem";

/**
 * Get the available wagmi connectors
 */
export const connectorsAtom = atom((get) => {
    // If on the server side, return nothing
    if (typeof window === "undefined") {
        return [];
    }
    // Fetch the current session
    const session = get(sessionAtom);
    if (!session) {
        return undefined;
    }

    // Build the smart account connector
    const connector = smartAccountConnector({
        // @ts-ignore - Chain typing is fcked up, TODO: Should be fixed
        accountBuilder: async ({ chainId }) => {
            // Get the viem client
            const chain = extractChain({
                chains: availableChains,
                id: chainId as AvailableChainIds,
            });
            if (!chain) {
                throw new Error(`Chain with id ${chainId} not configured`);
            }
            const viemClient = createClient({
                chain: chain,
                transport: getAlchemyTransport({ chain }),
                cacheTime: 60_000,
                batch: {
                    multicall: {
                        wait: 50,
                    },
                },
            });

            // Get the smart wallet client
            const { authenticatorId, publicKey } = session.wallet;
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

            // Get the bundler and paymaster clients
            const { bundlerTransport } = getBundlerClient(viemClient.chain);
            const paymasterClient = getPaymasterClient(viemClient.chain);

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
    });

    return [connector];
});

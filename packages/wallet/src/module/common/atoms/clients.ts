import type { AvailableChainIds } from "@/context/common/blockchain/provider";
import { getSignOptions } from "@/context/wallet/action/sign";
import { webAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import type { SmartAccountBuilder } from "@/context/wallet/smartWallet/connector";
import { parseWebAuthNAuthentication } from "@/context/wallet/smartWallet/webAuthN";
import { sessionAtom } from "@/module/common/atoms/session";
import { wagmiConfigAtom } from "@/module/common/atoms/wagmi";
import { startAuthentication } from "@simplewebauthn/browser";
import { getClient } from "@wagmi/core";
import { atom } from "jotai/index";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
import { http, type Chain, createClient } from "viem";

/**
 * Atom to get the bundler client for the given chain
 */
const getBundlerClient = (chain: Chain) => {
    // Build the pimlico bundler transport and client
    const bundlerTransport = http(
        `https://api.pimlico.io/v1/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    );
    const bundlerClient = createClient({
        chain,
        transport: bundlerTransport,
    });

    return {
        bundlerTransport,
        bundlerClient,
    };
};

/**
 * Atom to get the paymaster client for the given chain
 */
const getPaymasterClient = (chain: Chain) => {
    // If the chain isn't a testnet, exit without paymaster as default
    if (chain.testnet !== true) {
        return undefined;
    }

    // Build the paymaster client
    return createClient({
        chain,
        transport: http(
            `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        ),
    });
};

/**
 * Our smart account builder that will be used to create the smart account client
 */
export const smartAccountBuilderAtom = atom<
    SmartAccountBuilder<ENTRYPOINT_ADDRESS_V06_TYPE> | undefined
>((get) => {
    // Fetch the current session
    const session = get(sessionAtom);
    if (!session) {
        return undefined;
    }

    // Fetch the wagmi config
    const config = get(wagmiConfigAtom);
    if (!config) {
        return undefined;
    }

    // Then, create the fn that will build the smart account client
    const builder: SmartAccountBuilder<ENTRYPOINT_ADDRESS_V06_TYPE> = async ({
        chainId,
    }) => {
        // Get the viem client
        const viemClient = getClient(config, {
            chainId: chainId as AvailableChainIds,
        });
        if (!viemClient) {
            throw new Error("No viem client found");
        }

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
    };

    return builder;
});

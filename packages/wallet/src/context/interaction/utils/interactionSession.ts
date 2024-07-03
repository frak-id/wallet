import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { interactionSessionSmartAccount } from "@/context/wallet/smartWallet/InteractionSessionSmartWallet";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Get the safe session wallet client
 */
export async function getInteractionSessionClient({
    wallet,
}: {
    wallet: Address;
}) {
    const sessionStatus = await getSessionStatus({ wallet });
    if (!sessionStatus) {
        throw new Error("No session available for this user");
    }

    // Get our session private account
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // Get the bundler and paymaster clients
    const chain = frakChainPocClient.chain;
    const { bundlerTransport } = getBundlerClient(chain);
    const paymasterClient = getPaymasterClient(chain);

    // Build the interaction smart wallet
    const smartAccount = interactionSessionSmartAccount(frakChainPocClient, {
        sessionAccount,
        wallet,
    });

    // Build the wrapper around smart account to ease the tx flow
    return createSmartAccountClient({
        account: smartAccount,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        chain,
        bundlerTransport,
        // Only add a middleware if the paymaster client is available
        middleware: {
            sponsorUserOperation: (args) =>
                sponsorUserOperation(paymasterClient, args),
        },
    });
}

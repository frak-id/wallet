import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/blockchain/aa-provider";
import {
    contentInteractionManagerAbi,
    pressInteractionAbi,
} from "@/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@/context/blockchain/addresses";
import { contentIds } from "@/context/blockchain/contentIds";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { interactionSessionSmartAccount } from "@/context/wallet/smartWallet/InteractionSessionSmartWallet";
import {
    ENTRYPOINT_ADDRESS_V06,
    createSmartAccountClient,
} from "permissionless";
import { sponsorUserOperation } from "permissionless/actions/pimlico";
import { type Address, type Hex, encodeFunctionData, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";

/**
 * Try to push an interaction for the given wallet via an interaction
 */
export async function pushInteraction({ wallet }: { wallet: Address }) {
    // Get our session private account
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // Build the interaction smart wallet
    const smartAccount = interactionSessionSmartAccount(frakChainPocClient, {
        sessionAccount,
        wallet,
    });

    // Get the bundler and paymaster clients
    const chain = frakChainPocClient.chain;
    const { bundlerTransport } = getBundlerClient(chain);
    const paymasterClient = getPaymasterClient(chain);

    // Build the wrapper around smart account to ease the tx flow
    const smartAccountClient = createSmartAccountClient({
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

    // Get an interaction manager
    const interactionManager = await readContract(frakChainPocClient, {
        address: addresses.contentInteractionManager,
        abi: contentInteractionManagerAbi,
        functionName: "getInteractionContract",
        args: [contentIds.frak],
    });
    console.log("will push interaction to", {
        interactionManager,
        contentInteractionManager: addresses.contentInteractionManager,
    });

    // Build the interaction data
    const interactionData = encodeFunctionData({
        abi: pressInteractionAbi,
        functionName: "articleOpened",
        args: [pad("0x"), pad("0x")],
    });
    console.log("Will push interaction with data", { interactionData });

    // Push it
    const txHash = await smartAccountClient.sendTransaction({
        to: interactionManager,
        data: interactionData,
    });
    console.log("interaction pushed", { txHash });
}

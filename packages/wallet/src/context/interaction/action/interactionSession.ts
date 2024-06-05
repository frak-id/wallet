"use server";

import { kernelAddresses } from "@/context/blockchain/addresses";
import { frakChainPocClient } from "@/context/blockchain/provider";
import { interactionSessionValidatorAbi } from "@/context/wallet/abi/kernel-v2-abis";
import {
    type Address,
    type Hex,
    encodeAbiParameters,
    encodeFunctionData,
    isAddressEqual,
    zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";

/**
 * Get the current session status
 * @param wallet
 */
export async function getSessionStatus({
    wallet,
}: { wallet: Address }): Promise<{
    sessionStart: Date;
    sessionEnd: Date;
} | null> {
    // Read all the prices from the blockchain
    const status = await readContract(frakChainPocClient, {
        address: kernelAddresses.interactionSessionValidator,
        abi: interactionSessionValidatorAbi,
        functionName: "getCurrentSession",
        args: [wallet],
    });

    // If the session is not valid, return null
    if (isAddressEqual(status.sessionValidator, zeroAddress)) {
        return null;
    }

    // Parse date
    const sessionStart = new Date(status.sessionStart * 1000);
    const sessionEnd = new Date(status.sessionEnd * 1000);
    const now = new Date();

    // If session expired, return null
    if (sessionStart > now || now > sessionEnd) {
        return null;
    }

    // Return the session status
    return {
        sessionStart,
        sessionEnd,
    };
}

/**
 * Get an interaction session enable data
 * @param sessionEnd
 */
export async function getSessionEnableData({
    sessionEnd,
}: { sessionEnd: Date }): Promise<Hex> {
    // So this shouldn't be the airdropper private key
    // todo: Only temporary for testing purposes, will be reinforced
    const sessionPrivateKey = process.env.AIRDROP_PRIVATE_KEY;
    if (!sessionPrivateKey) {
        throw new Error("Missing AIRDROP_PRIVATE_KEY env variable");
    }

    // Get our session signer
    const sessionAccount = privateKeyToAccount(sessionPrivateKey as Hex);

    // Get allowed after (date.now / 1000) and  until
    const start = BigInt(Math.floor(Date.now() / 1000));
    const end = BigInt(Math.floor(sessionEnd.getTime() / 1000));

    // Build the enable data
    const enableDataLayout = [
        { name: "sessionStart", type: "uint256" },
        { name: "sessionEnd", type: "uint256" },
        { name: "sessionValidator", type: "address" },
    ] as const;
    const enableData = encodeAbiParameters(enableDataLayout, [
        start,
        end,
        sessionAccount.address,
    ]);

    // Encode the init function call
    return encodeFunctionData({
        abi: interactionSessionValidatorAbi,
        functionName: "enable",
        args: [enableData],
    });
}

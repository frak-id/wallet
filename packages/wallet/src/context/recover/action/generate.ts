"use server";

import { setExecutionAbi } from "@/context/recover/utils/abi";
import {
    kernelEcdsaValidator,
    recoveryAction,
} from "@/context/recover/utils/recover";
import type { GeneratedRecoveryData } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { encodeFunctionData, toFunctionSelector } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Generate the recovery data
 */
export async function generateRecoveryData({
    wallet,
}: { wallet: WebAuthNWallet }): Promise<GeneratedRecoveryData> {
    // Generate burner info
    const burnerPrivateKey = generatePrivateKey();
    const burnerAccount = privateKeyToAccount(burnerPrivateKey);

    // Get the recovery selector
    const recoverySelector = toFunctionSelector(recoveryAction.executorFn);

    // Generate the setup tx data
    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            // Do recovery method
            recoverySelector,
            // And do recovery contract
            recoveryAction.address,
            // The address of the ecdsa validator
            kernelEcdsaValidator,
            // Valid until / valid after timestamps, keep that as 0
            0,
            0,
            // Data used to validate the ecdsa validator
            burnerAccount.address,
        ],
    });

    // TODO: We should also fetch the initial initData for a wallet, it would help redeploy and change the wallet accross different chains

    // Return all the stuff wanted
    return {
        wallet,
        burner: {
            privateKey: burnerPrivateKey,
            address: burnerAccount.address,
        },
        setupTxData: txData,
    };
}

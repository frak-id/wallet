"use server";

import { kernelAddresses } from "@/context/common/blockchain/addresses";
import { isRunningInProd } from "@/context/common/env";
import {
    doAddPassKeyFnAbi,
    installValidationAbi,
} from "@/context/recover/utils/abi";
import { toRecoveryPolicy } from "@/context/recover/utils/recoveryPolicy";
import type { GeneratedRecoveryData } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { PolicyFlags } from "@zerodev/permissions";
import { toPolicyId } from "@zerodev/permissions/policies";
import {
    type Address,
    concat,
    encodeAbiParameters,
    encodeFunctionData,
    keccak256,
    pad,
    slice,
    toFunctionSelector,
    zeroAddress,
} from "viem";

/**
 * Generate the recovery data
 * TODO: Is wallet rly needed? Should we perform check beforehand?
 */
export async function generateRecoveryData({
    guardianAddress,
}: {
    wallet: WebAuthNWallet;
    guardianAddress: Address;
}): Promise<GeneratedRecoveryData> {
    // Get the recovery selector
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

    // Craft the valid after timestamp (one week from now), otherwise valid in 5min
    const validAfter = isRunningInProd
        ? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
        : Math.floor(Date.now() / 1000) + 60 * 5;

    // Then build the recover policy
    const recoveryPolicy = toRecoveryPolicy({
        recoverContract: kernelAddresses.v3.recoveryPolicy,
        recoverSelector: addPasskeySelector,
        activeAt: validAfter,
    });

    // Build the ecdsa signer that will be responsible to sign the recovery
    const enableData = encodeAbiParameters(
        [{ name: "policyAndSignerData", type: "bytes[]" }],
        [
            [
                // The recover policy itself
                concat([
                    recoveryPolicy.getPolicyInfoInBytes(),
                    recoveryPolicy.getPolicyData(),
                ]),
                // The permission itself
                concat([
                    PolicyFlags.FOR_ALL_VALIDATION,
                    kernelAddresses.v3.ecdsaSigner,
                    guardianAddress,
                ]),
            ],
        ]
    );
    const permissionIdData = encodeAbiParameters(
        [{ name: "policyAndSignerData", type: "bytes[]" }],
        [
            [
                // Policy id
                toPolicyId([recoveryPolicy]),
                // Policy flag
                PolicyFlags.FOR_ALL_VALIDATION,
                // Signer id
                encodeAbiParameters(
                    [{ name: "signerData", type: "bytes" }],
                    [concat([kernelAddresses.v3.ecdsaSigner, guardianAddress])]
                ),
            ],
        ]
    );
    const permissionId = slice(keccak256(permissionIdData), 0, 4);

    // Generate the setup tx data
    const txData = encodeFunctionData({
        abi: [installValidationAbi],
        functionName: "installValidations",
        args: [
            // The validations ids (0x02 -> Type Permission + permission ID)
            [
                concat([
                    "0x02",
                    pad(permissionId, {
                        size: 20,
                        dir: "right",
                    }),
                ]),
            ],
            // The validation configs
            [
                {
                    nonce: BigInt(
                        "0x93228CA325349FC7D8C397BECC0515E370AA455500000000000000000000"
                    ),
                    hook: zeroAddress,
                },
            ],
            // The validation data
            [enableData],
            // The hook data
            ["0x"],
        ],
    });
    // Return all the stuff wanted
    return {
        guardianAddress,
        setupTxData: txData,
    };
}

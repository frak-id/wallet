import { kernelAddresses } from "@/context/common/blockchain/addresses";
import {
    type Policy,
    PolicyFlags,
    type PolicyParams,
} from "@zerodev/permissions";
import type { SudoPolicyParams } from "@zerodev/permissions/policies";
import { type Address, type Hex, concatHex, encodeAbiParameters } from "viem";

type RecoveryPolicyParams = {
    recoverContract: Address;
    recoverSelector: Hex;
    activeAt: number;
} & PolicyParams;

/**
 * Build our recovery policy
 * @param policyAddress
 * @param policyFlag
 * @param recoverContract
 * @param recoverSelector
 * @param activeAt
 */
export function toRecoveryPolicy({
    policyAddress = kernelAddresses.v3.recoveryPolicy,
    policyFlag = PolicyFlags.FOR_ALL_VALIDATION,
    recoverContract,
    recoverSelector,
    activeAt,
}: RecoveryPolicyParams): Policy {
    return {
        getPolicyData: () =>
            encodeAbiParameters(
                [
                    { name: "recoverContract", type: "address" },
                    { name: "recoverSelector", type: "bytes4" },
                    { name: "activeAt", type: "uint48" },
                ],
                [recoverContract, recoverSelector, activeAt]
            ),
        getPolicyInfoInBytes: () => concatHex([policyFlag, policyAddress]),
        // @ts-ignore: TODO: Kernel SDK only support pre defined policy right now, need to be updated
        policyParams: {
            type: "recovery",
            policyAddress,
            policyFlag,
        } as SudoPolicyParams & { type: "recovery" },
    };
}

import { addresses, getExecutionAbi } from "@frak-labs/app-essentials";
import { memo, tryit } from "radash";
import { type Address, isAddressEqual, toFunctionSelector } from "viem";
import { readContract } from "viem/actions";
import { getViemClient } from "../../blockchain/client";

const sendInteractionSelector = toFunctionSelector({
    type: "function",
    inputs: [
        {
            name: "_interaction",
            internalType: "struct Interaction",
            type: "tuple",
            components: [
                {
                    name: "productId",
                    internalType: "uint256",
                    type: "uint256",
                },
                { name: "data", internalType: "bytes", type: "bytes" },
            ],
        },
    ],
    name: "sendInteraction",
    outputs: [],
    stateMutability: "nonpayable",
});

/**
 * Ensure that the wallet has an active session
 */
export const walletHasValidSession = memo(
    async ({ wallet }: { wallet: Address }) => {
        // Ensure that the wallet as an active session
        const [, status] = await tryit(() =>
            readContract(getViemClient(), {
                address: wallet,
                abi: [getExecutionAbi],
                functionName: "getExecution",
                args: [sendInteractionSelector],
            })
        )();
        if (!status) {
            return false;
        }

        // If it's not on the latest executor or validator, return null
        if (
            !(
                isAddressEqual(
                    status.executor,
                    addresses.interactionDelegatorAction
                ) &&
                isAddressEqual(
                    status.validator,
                    addresses.interactionDelegatorValidator
                )
            )
        ) {
            return false;
        }

        // Parse date
        const sessionStart = new Date(status.validAfter * 1000);
        const sessionEnd = new Date(status.validUntil * 1000);
        const now = new Date();

        // If session expired, return null
        return now > sessionStart || sessionEnd > now;
    },
    { key: ({ wallet }) => `${wallet}-has-valid-session` }
);

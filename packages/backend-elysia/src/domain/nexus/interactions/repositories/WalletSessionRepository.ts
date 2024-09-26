import { addresses } from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import {
    type Address,
    type Client,
    isAddressEqual,
    toFunctionSelector,
} from "viem";
import { readContract } from "viem/actions";

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
 * Abi used to get the execution details
 */
export const getExecutionAbi = {
    type: "function",
    name: "getExecution",
    inputs: [{ name: "_selector", type: "bytes4", internalType: "bytes4" }],
    outputs: [
        {
            name: "",
            type: "tuple",
            internalType: "struct ExecutionDetail",
            components: [
                {
                    name: "validAfter",
                    type: "uint48",
                    internalType: "uint48",
                },
                {
                    name: "validUntil",
                    type: "uint48",
                    internalType: "uint48",
                },
                {
                    name: "executor",
                    type: "address",
                    internalType: "address",
                },
                {
                    name: "validator",
                    type: "address",
                    internalType: "contract IKernelValidator",
                },
            ],
        },
    ],
    stateMutability: "view",
} as const;

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class WalletSessionRepository {
    private sessionValidityCache = new LRUCache<Address, boolean>({
        max: 256,
        // TTL of 15min
        ttl: 15 * 60 * 1000,
    });

    constructor(private readonly client: Client) {}

    /**
     * Check if the user session is valid
     */
    async isSessionValid(wallet: Address): Promise<boolean> {
        const cached = this.sessionValidityCache.get(wallet);
        if (cached) {
            return cached;
        }

        // Get the current session status (and exit with false if failing)
        let sessionStatus: {
            validAfter: number;
            validUntil: number;
            executor: Address;
            validator: Address;
        };
        try {
            sessionStatus = await readContract(this.client, {
                address: wallet,
                abi: [getExecutionAbi],
                functionName: "getExecution",
                args: [sendInteractionSelector],
            });
        } catch (_e) {
            this.sessionValidityCache.set(wallet, false);
            return false;
        }

        // Ensure the session addresses match
        if (
            !(
                isAddressEqual(
                    sessionStatus.executor,
                    addresses.interactionDelegatorAction
                ) &&
                isAddressEqual(
                    sessionStatus.validator,
                    addresses.interactionDelegatorValidator
                )
            )
        ) {
            this.sessionValidityCache.set(wallet, false);
            return false;
        }

        // Parse date
        const sessionStart = new Date(sessionStatus.validAfter * 1000);
        const sessionEnd = new Date(sessionStatus.validUntil * 1000);
        const now = new Date();

        if (now > sessionStart || sessionEnd > now) {
            this.sessionValidityCache.set(wallet, false);
            return false;
        }

        // Otherwise, check if it's expiring in less than 15min, if yes set with custom ttl
        const timeToExpire = sessionEnd.getTime() - now.getTime();
        if (timeToExpire < 15 * 60 * 1000) {
            this.sessionValidityCache.set(wallet, true, {
                ttl: timeToExpire,
            });
        } else {
            this.sessionValidityCache.set(wallet, true);
        }
        return true;
    }
}

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
 * Abi used to mint a few test tokens
 */
export const mintAbi = {
    type: "function",
    inputs: [
        { name: "_to", internalType: "address", type: "address" },
        { name: "_amount", internalType: "uint256", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

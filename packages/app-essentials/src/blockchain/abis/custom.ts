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

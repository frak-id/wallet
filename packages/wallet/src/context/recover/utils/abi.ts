/**
 * Abi used to define an execution on the given kernel
 */
export const setExecutionAbi = {
    type: "function",
    name: "setExecution",
    inputs: [
        { name: "_selector", type: "bytes4", internalType: "bytes4" },
        { name: "_executor", type: "address", internalType: "address" },
        {
            name: "_validator",
            type: "address",
            internalType: "contract IKernelValidator",
        },
        { name: "_validUntil", type: "uint48", internalType: "uint48" },
        { name: "_validAfter", type: "uint48", internalType: "uint48" },
        { name: "_enableData", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
} as const;

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
 * Abi used to get the ecdsa validator storage
 */
export const ecdsaValidatorStorageAbi = {
    type: "function",
    name: "ecdsaValidatorStorage",
    inputs: [
        {
            name: "",
            type: "address",
            internalType: "address",
        },
    ],
    outputs: [
        {
            name: "owner",
            type: "address",
            internalType: "address",
        },
    ],
    stateMutability: "view",
} as const;

/**
 * Function to add a passkey to the multi webauthn contract
 */
export const doAddPassKeyFnAbi = {
    type: "function",
    inputs: [
        { name: "authenticatorId", internalType: "bytes32", type: "bytes32" },
        { name: "x", internalType: "uint256", type: "uint256" },
        { name: "y", internalType: "uint256", type: "uint256" },
    ],
    name: "doAddPasskey",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

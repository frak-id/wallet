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

/**
 * MultiWebAuthNValidatorV2 `getPasskey(wallet, authenticatorIdHash)` view.
 *
 * Wallet-local partial: the full validator ABI (~4.75 KB raw) carries a dozen
 * admin items the recovery flow never reads (`addPassKey`, `removePassKey`,
 * `validateUserOp`, all events/errors). Inlining only this overload keeps the
 * lazy `feature-auth` chunk lean.
 */
export const webAuthNGetPasskeyAbi = {
    type: "function",
    name: "getPasskey",
    inputs: [
        { name: "_smartWallet", type: "address" },
        { name: "_authenticatorId", type: "bytes32" },
    ],
    outputs: [
        { name: "", type: "bytes32" },
        {
            name: "",
            type: "tuple",
            components: [
                { name: "x", type: "uint256" },
                { name: "y", type: "uint256" },
            ],
        },
    ],
    stateMutability: "view",
} as const;

/**
 * ABI for the Monerium SignMsg kernel action extension.
 * Emits SignMsg(bytes32) for onchain ERC-1271 signature verification.
 *
 * Two signing methods:
 * - signMessage(bytes): contract hashes the message internally (Safe-style structured hash)
 * - signMessageRaw(bytes32): emits the raw hash directly
 */
export const moneriumSignMsgActionAbi = [
    {
        type: "function",
        inputs: [{ name: "_message", internalType: "bytes", type: "bytes" }],
        name: "getMessageHash",
        outputs: [
            { name: "msgHash", internalType: "bytes32", type: "bytes32" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_msgHash", internalType: "bytes32", type: "bytes32" },
        ],
        name: "isSignedMessage",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_data", internalType: "bytes", type: "bytes" }],
        name: "signMessage",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_msgHash", internalType: "bytes32", type: "bytes32" },
        ],
        name: "signMessageRaw",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "msgHash",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "SignMsg",
    },
    { type: "error", inputs: [], name: "EmptyMessage" },
] as const;

export const signMessageFnAbi = {
    type: "function",
    inputs: [{ name: "_data", internalType: "bytes", type: "bytes" }],
    name: "signMessage",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

export const signMessageRawFnAbi = {
    type: "function",
    inputs: [{ name: "_msgHash", internalType: "bytes32", type: "bytes32" }],
    name: "signMessageRaw",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

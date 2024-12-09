export const productInteractionDiamond_hasAllRoles = {
    type: "function",
    inputs: [
        { name: "user", internalType: "address", type: "address" },
        { name: "roles", internalType: "uint256", type: "uint256" },
    ],
    name: "hasAllRoles",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
} as const;

export const productInteractionDiamond_delegateToFacet = {
    type: "function",
    inputs: [
        {
            name: "_productTypeDenominator",
            internalType: "uint8",
            type: "uint8",
        },
        { name: "_call", internalType: "bytes", type: "bytes" },
    ],
    name: "delegateToFacet",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

export const productInteractionDiamond_handleInteraction = {
    type: "function",
    inputs: [
        { name: "_interaction", internalType: "bytes", type: "bytes" },
        { name: "_signature", internalType: "bytes", type: "bytes" },
    ],
    name: "handleInteraction",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

import { toFunctionSelector } from "viem";

export const sendInteractionSelector = toFunctionSelector({
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
// Get the recovery selector
export const sendInteractionsSelector = toFunctionSelector({
    type: "function",
    inputs: [
        {
            name: "_interactions",
            internalType: "struct Interaction[]",
            type: "tuple[]",
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
    name: "sendInteractions",
    outputs: [],
    stateMutability: "nonpayable",
});

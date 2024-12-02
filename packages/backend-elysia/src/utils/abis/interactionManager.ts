export const interactionManager_deployInteractionContract = {
    type: "function",
    inputs: [{ name: "_productId", internalType: "uint256", type: "uint256" }],
    name: "deployInteractionContract",
    outputs: [
        {
            name: "diamond",
            internalType: "contract ProductInteractionDiamond",
            type: "address",
        },
    ],
    stateMutability: "nonpayable",
} as const;

export const interactionManager_getInteractionContract = {
    type: "function",
    inputs: [{ name: "_productId", internalType: "uint256", type: "uint256" }],
    name: "getInteractionContract",
    outputs: [
        {
            name: "interactionContract",
            internalType: "contract ProductInteractionDiamond",
            type: "address",
        },
    ],
    stateMutability: "view",
} as const;

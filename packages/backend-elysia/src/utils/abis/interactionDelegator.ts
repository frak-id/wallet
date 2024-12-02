export const interactionDelegator_execute = {
    type: "function",
    inputs: [
        {
            name: "_delegatedInteractions",
            internalType: "struct InteractionDelegator.DelegatedInteraction[]",
            type: "tuple[]",
            components: [
                {
                    name: "wallet",
                    internalType: "address",
                    type: "address",
                },
                {
                    name: "interaction",
                    internalType: "struct Interaction",
                    type: "tuple",
                    components: [
                        {
                            name: "productId",
                            internalType: "uint256",
                            type: "uint256",
                        },
                        {
                            name: "data",
                            internalType: "bytes",
                            type: "bytes",
                        },
                    ],
                },
            ],
        },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

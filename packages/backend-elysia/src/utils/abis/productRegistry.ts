export const productRegistry_getMetadata = {
    type: "function",
    inputs: [{ name: "_productId", internalType: "uint256", type: "uint256" }],
    name: "getMetadata",
    outputs: [
        {
            name: "",
            internalType: "struct Metadata",
            type: "tuple",
            components: [
                {
                    name: "productTypes",
                    internalType: "ProductTypes",
                    type: "uint256",
                },
                { name: "name", internalType: "bytes32", type: "bytes32" },
                { name: "domain", internalType: "string", type: "string" },
                {
                    name: "customMetadataUrl",
                    internalType: "string",
                    type: "string",
                },
            ],
        },
    ],
    stateMutability: "view",
} as const;

export const productRegistry_mint = {
    type: "function",
    inputs: [
        {
            name: "_productTypes",
            internalType: "ProductTypes",
            type: "uint256",
        },
        { name: "_name", internalType: "bytes32", type: "bytes32" },
        { name: "_domain", internalType: "string", type: "string" },
        { name: "_owner", internalType: "address", type: "address" },
    ],
    name: "mint",
    outputs: [{ name: "id", internalType: "uint256", type: "uint256" }],
    stateMutability: "nonpayable",
} as const;

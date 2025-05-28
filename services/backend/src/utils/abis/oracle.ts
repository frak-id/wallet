export const purchaseOracle_getMerkleRoot = {
    type: "function",
    inputs: [{ name: "_productId", internalType: "uint256", type: "uint256" }],
    name: "getMerkleRoot",
    outputs: [{ name: "merkleRoot", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
} as const;

export const purchaseOracle_updateMerkleRoot = {
    type: "function",
    inputs: [
        { name: "_productId", internalType: "uint256", type: "uint256" },
        { name: "_merkleRoot", internalType: "bytes32", type: "bytes32" },
    ],
    name: "updateMerkleRoot",
    outputs: [],
    stateMutability: "nonpayable",
} as const;

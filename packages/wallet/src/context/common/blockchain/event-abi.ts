export const paidItemUnlockedEventAbi = {
    type: "event",
    anonymous: false,
    inputs: [
        {
            name: "contentId",
            internalType: "ContentId",
            type: "uint256",
            indexed: true,
        },
        {
            name: "articleId",
            internalType: "bytes32",
            type: "bytes32",
            indexed: true,
        },
        {
            name: "user",
            internalType: "address",
            type: "address",
            indexed: true,
        },
        {
            name: "paidAmount",
            internalType: "uint256",
            type: "uint256",
            indexed: false,
        },
        {
            name: "allowedUntil",
            internalType: "uint48",
            type: "uint48",
            indexed: false,
        },
    ],
    name: "PaidItemUnlocked",
} as const;

export const frkTransferEvent = {
    type: "event",
    anonymous: false,
    inputs: [
        {
            name: "from",
            internalType: "address",
            type: "address",
            indexed: true,
        },
        {
            name: "to",
            internalType: "address",
            type: "address",
            indexed: true,
        },
        {
            name: "value",
            internalType: "uint256",
            type: "uint256",
            indexed: false,
        },
    ],
    name: "Transfer",
} as const;

export const erc6909Transfer = {
    type: "event",
    anonymous: false,
    inputs: [
        {
            name: "by",
            internalType: "address",
            type: "address",
            indexed: false,
        },
        {
            name: "from",
            internalType: "address",
            type: "address",
            indexed: true,
        },
        {
            name: "to",
            internalType: "address",
            type: "address",
            indexed: true,
        },
        {
            name: "id",
            internalType: "uint256",
            type: "uint256",
            indexed: true,
        },
        {
            name: "amount",
            internalType: "uint256",
            type: "uint256",
            indexed: false,
        },
    ],
    name: "Transfer",
} as const;

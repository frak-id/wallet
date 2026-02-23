export const campaignBankAbi = [
    {
        type: "function",
        inputs: [
            { name: "user", internalType: "address", type: "address" },
            { name: "roles", internalType: "uint256", type: "uint256" },
        ],
        name: "grantRoles",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "user", internalType: "address", type: "address" },
            { name: "roles", internalType: "uint256", type: "uint256" },
        ],
        name: "revokeRoles",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "user", internalType: "address", type: "address" }],
        name: "rolesOf",
        outputs: [{ name: "roles", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_token", internalType: "address", type: "address" }],
        name: "getBalance",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_token", internalType: "address", type: "address" }],
        name: "getAllowance",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isOpen",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "owner",
        outputs: [{ name: "result", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_isOpen", internalType: "bool", type: "bool" }],
        name: "setOpen",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_tokens", internalType: "address[]", type: "address[]" },
            {
                name: "_amounts",
                internalType: "uint256[]",
                type: "uint256[]",
            },
        ],
        name: "updateAllowances",
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;

export const campaignBankFactoryAbi = [
    {
        type: "function",
        inputs: [{ name: "_owner", internalType: "address", type: "address" }],
        name: "deployBank",
        outputs: [
            {
                name: "bank",
                internalType: "contract CampaignBank",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_owner", internalType: "address", type: "address" },
            { name: "_salt", internalType: "bytes32", type: "bytes32" },
        ],
        name: "deployBank",
        outputs: [
            {
                name: "bank",
                internalType: "contract CampaignBank",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [{ name: "_salt", internalType: "bytes32", type: "bytes32" }],
        name: "predictBankAddress",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "owner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "bank",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "BankDeployed",
    },
] as const;

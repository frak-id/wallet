//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FrakToken
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const frakTokenAbi = [
    { type: "constructor", inputs: [], stateMutability: "nonpayable" },
    {
        type: "function",
        inputs: [
            { name: "owner", internalType: "address", type: "address" },
            { name: "spender", internalType: "address", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "spender", internalType: "address", type: "address" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [{ name: "account", internalType: "address", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "amount", internalType: "uint256", type: "uint256" }],
        name: "burn",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "cap",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", internalType: "uint8", type: "uint8" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "spender", internalType: "address", type: "address" },
            {
                name: "subtractedValue",
                internalType: "uint256",
                type: "uint256",
            },
        ],
        name: "decreaseAllowance",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "getDomainSeperator",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "user", internalType: "address", type: "address" }],
        name: "getNonce",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "grantRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "hasRole",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "spender", internalType: "address", type: "address" },
            { name: "addedValue", internalType: "uint256", type: "uint256" },
        ],
        name: "increaseAllowance",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "to", internalType: "address", type: "address" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "name",
        outputs: [{ name: "", internalType: "string", type: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "owner", internalType: "address", type: "address" },
            { name: "spender", internalType: "address", type: "address" },
            { name: "value", internalType: "uint256", type: "uint256" },
            { name: "deadline", internalType: "uint256", type: "uint256" },
            { name: "v", internalType: "uint8", type: "uint8" },
            { name: "r", internalType: "bytes32", type: "bytes32" },
            { name: "s", internalType: "bytes32", type: "bytes32" },
        ],
        name: "permit",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "proxiableUUID",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "renounceRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "revokeRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", internalType: "string", type: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "to", internalType: "address", type: "address" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "from", internalType: "address", type: "address" },
            { name: "to", internalType: "address", type: "address" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "updateToDiamondEip712",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
        ],
        name: "upgradeTo",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
            { name: "data", internalType: "bytes", type: "bytes" },
        ],
        name: "upgradeToAndCall",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "previousAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "newAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "AdminChanged",
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
                name: "spender",
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
        name: "Approval",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "beacon",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "BeaconUpgraded",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "version",
                internalType: "uint8",
                type: "uint8",
                indexed: false,
            },
        ],
        name: "Initialized",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleGranted",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleRevoked",
    },
    {
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
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "implementation",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "Upgraded",
    },
    { type: "error", inputs: [], name: "CapExceed" },
    { type: "error", inputs: [], name: "InvalidSigner" },
    { type: "error", inputs: [], name: "RenounceForCallerOnly" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// FraktionTokens
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const fraktionTokensAbi = [
    { type: "constructor", inputs: [], stateMutability: "nonpayable" },
    {
        type: "function",
        inputs: [
            { name: "id", internalType: "FraktionId", type: "uint256" },
            { name: "supply", internalType: "uint256", type: "uint256" },
        ],
        name: "addSupply",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "account", internalType: "address", type: "address" },
            { name: "id", internalType: "uint256", type: "uint256" },
        ],
        name: "balanceOf",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "accounts", internalType: "address[]", type: "address[]" },
            { name: "ids", internalType: "uint256[]", type: "uint256[]" },
        ],
        name: "balanceOfBatch",
        outputs: [{ name: "", internalType: "uint256[]", type: "uint256[]" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "account", internalType: "address", type: "address" },
            { name: "ids", internalType: "FraktionId[]", type: "uint256[]" },
        ],
        name: "balanceOfIdsBatch",
        outputs: [
            {
                name: "batchBalances",
                internalType: "uint256[]",
                type: "uint256[]",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "id", internalType: "FraktionId", type: "uint256" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "burn",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "getDomainSeperator",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "user", internalType: "address", type: "address" }],
        name: "getNonce",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "grantRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "hasRole",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "metadatalUrl", internalType: "string", type: "string" },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "account", internalType: "address", type: "address" },
            { name: "operator", internalType: "address", type: "address" },
        ],
        name: "isApprovedForAll",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "to", internalType: "address", type: "address" },
            { name: "id", internalType: "FraktionId", type: "uint256" },
            { name: "amount", internalType: "uint256", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "ownerAddress", internalType: "address", type: "address" },
            {
                name: "suppliesToType",
                internalType: "uint256[]",
                type: "uint256[]",
            },
        ],
        name: "mintNewContent",
        outputs: [{ name: "id", internalType: "ContentId", type: "uint256" }],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "contentId", internalType: "ContentId", type: "uint256" },
        ],
        name: "ownerOf",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "owner", internalType: "address", type: "address" },
            { name: "spender", internalType: "address", type: "address" },
            { name: "deadline", internalType: "uint256", type: "uint256" },
            { name: "v", internalType: "uint8", type: "uint8" },
            { name: "r", internalType: "bytes32", type: "bytes32" },
            { name: "s", internalType: "bytes32", type: "bytes32" },
        ],
        name: "permitAllTransfer",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "proxiableUUID",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "callbackAddr", internalType: "address", type: "address" },
        ],
        name: "registerNewCallback",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "renounceRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "revokeRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "from", internalType: "address", type: "address" },
            { name: "to", internalType: "address", type: "address" },
            { name: "ids", internalType: "uint256[]", type: "uint256[]" },
            { name: "amounts", internalType: "uint256[]", type: "uint256[]" },
            { name: "data", internalType: "bytes", type: "bytes" },
        ],
        name: "safeBatchTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "from", internalType: "address", type: "address" },
            { name: "to", internalType: "address", type: "address" },
            { name: "id", internalType: "uint256", type: "uint256" },
            { name: "amount", internalType: "uint256", type: "uint256" },
            { name: "data", internalType: "bytes", type: "bytes" },
        ],
        name: "safeTransferFrom",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "operator", internalType: "address", type: "address" },
            { name: "approved", internalType: "bool", type: "bool" },
        ],
        name: "setApprovalForAll",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "tokenId", internalType: "FraktionId", type: "uint256" },
        ],
        name: "supplyOf",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "interfaceId", internalType: "bytes4", type: "bytes4" },
        ],
        name: "supportsInterface",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "from", internalType: "address", type: "address" },
            { name: "to", internalType: "address", type: "address" },
            { name: "ids", internalType: "uint256[]", type: "uint256[]" },
        ],
        name: "transferAllFrom",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "updateToDiamondEip712",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
        ],
        name: "upgradeTo",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
            { name: "data", internalType: "bytes", type: "bytes" },
        ],
        name: "upgradeToAndCall",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        name: "uri",
        outputs: [{ name: "", internalType: "string", type: "string" }],
        stateMutability: "view",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "previousAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "newAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "AdminChanged",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "operator",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "approved",
                internalType: "bool",
                type: "bool",
                indexed: false,
            },
        ],
        name: "ApprovalForAll",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "beacon",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "BeaconUpgraded",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "id",
                internalType: "uint256",
                type: "uint256",
                indexed: true,
            },
            {
                name: "owner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "ContentOwnerUpdated",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "version",
                internalType: "uint8",
                type: "uint8",
                indexed: false,
            },
        ],
        name: "Initialized",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleGranted",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleRevoked",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "id",
                internalType: "uint256",
                type: "uint256",
                indexed: true,
            },
            {
                name: "supply",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "SuplyUpdated",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "operator",
                internalType: "address",
                type: "address",
                indexed: true,
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
                name: "ids",
                internalType: "uint256[]",
                type: "uint256[]",
                indexed: false,
            },
            {
                name: "values",
                internalType: "uint256[]",
                type: "uint256[]",
                indexed: false,
            },
        ],
        name: "TransferBatch",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "operator",
                internalType: "address",
                type: "address",
                indexed: true,
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
                indexed: false,
            },
            {
                name: "value",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "TransferSingle",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "value",
                internalType: "string",
                type: "string",
                indexed: false,
            },
            {
                name: "id",
                internalType: "uint256",
                type: "uint256",
                indexed: true,
            },
        ],
        name: "URI",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "implementation",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "Upgraded",
    },
    { type: "error", inputs: [], name: "InsuficiantSupply" },
    { type: "error", inputs: [], name: "InvalidSigner" },
    { type: "error", inputs: [], name: "RenounceForCallerOnly" },
    { type: "error", inputs: [], name: "SupplyUpdateNotAllowed" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Paywall
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const paywallAbi = [
    { type: "constructor", inputs: [], stateMutability: "nonpayable" },
    {
        type: "function",
        inputs: [
            { name: "_contentId", internalType: "ContentId", type: "uint256" },
            {
                name: "price",
                internalType: "struct IPaywall.UnlockPrice",
                type: "tuple",
                components: [
                    { name: "price", internalType: "uint256", type: "uint256" },
                    {
                        name: "allowanceTime",
                        internalType: "uint32",
                        type: "uint32",
                    },
                    {
                        name: "isPriceEnabled",
                        internalType: "bool",
                        type: "bool",
                    },
                ],
            },
        ],
        name: "addPrice",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_contentId", internalType: "ContentId", type: "uint256" },
        ],
        name: "disablePaywall",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [{ name: "user", internalType: "address", type: "address" }],
        name: "getAvailableFounds",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_contentId", internalType: "ContentId", type: "uint256" },
        ],
        name: "getContentPrices",
        outputs: [
            {
                name: "prices",
                internalType: "struct IPaywall.UnlockPrice[]",
                type: "tuple[]",
                components: [
                    { name: "price", internalType: "uint256", type: "uint256" },
                    {
                        name: "allowanceTime",
                        internalType: "uint32",
                        type: "uint32",
                    },
                    {
                        name: "isPriceEnabled",
                        internalType: "bool",
                        type: "bool",
                    },
                ],
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "grantRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "hasRole",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_frkTokenAddr", internalType: "address", type: "address" },
            {
                name: "_fraktionTokensAddr",
                internalType: "address",
                type: "address",
            },
            {
                name: "_frakLabsWalletAddr",
                internalType: "address",
                type: "address",
            },
        ],
        name: "initialize",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "contentId", internalType: "ContentId", type: "uint256" },
            { name: "articleId", internalType: "bytes32", type: "bytes32" },
            { name: "user", internalType: "address", type: "address" },
        ],
        name: "isReadAllowed",
        outputs: [
            { name: "isAllowed", internalType: "bool", type: "bool" },
            { name: "allowedUntil", internalType: "uint256", type: "uint256" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "proxiableUUID",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "renounceRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "role", internalType: "bytes32", type: "bytes32" },
            { name: "account", internalType: "address", type: "address" },
        ],
        name: "revokeRole",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_contentId", internalType: "ContentId", type: "uint256" },
            { name: "_articleId", internalType: "bytes32", type: "bytes32" },
            { name: "_priceIndex", internalType: "uint256", type: "uint256" },
        ],
        name: "unlockAccess",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_contentId", internalType: "ContentId", type: "uint256" },
            { name: "_priceIndex", internalType: "uint256", type: "uint256" },
            {
                name: "_price",
                internalType: "struct IPaywall.UnlockPrice",
                type: "tuple",
                components: [
                    { name: "price", internalType: "uint256", type: "uint256" },
                    {
                        name: "allowanceTime",
                        internalType: "uint32",
                        type: "uint32",
                    },
                    {
                        name: "isPriceEnabled",
                        internalType: "bool",
                        type: "bool",
                    },
                ],
            },
        ],
        name: "updatePrice",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
        ],
        name: "upgradeTo",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "newImplementation",
                internalType: "address",
                type: "address",
            },
            { name: "data", internalType: "bytes", type: "bytes" },
        ],
        name: "upgradeToAndCall",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "withdrawFounds",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [{ name: "user", internalType: "address", type: "address" }],
        name: "withdrawFounds",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "previousAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "newAdmin",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "AdminChanged",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "beacon",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "BeaconUpgraded",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "version",
                internalType: "uint8",
                type: "uint8",
                indexed: false,
            },
        ],
        name: "Initialized",
    },
    {
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
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "user",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "RewardAdded",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "user",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
            {
                name: "fees",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "RewardWithdrawed",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleGranted",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "account",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "role",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
        ],
        name: "RoleRevoked",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "implementation",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "Upgraded",
    },
    {
        type: "error",
        inputs: [
            { name: "contentId", internalType: "ContentId", type: "uint256" },
            { name: "articleId", internalType: "bytes32", type: "bytes32" },
        ],
        name: "ArticleAlreadyUnlocked",
    },
    {
        type: "error",
        inputs: [
            { name: "contentId", internalType: "ContentId", type: "uint256" },
            { name: "articleId", internalType: "bytes32", type: "bytes32" },
            { name: "priceIndex", internalType: "uint256", type: "uint256" },
        ],
        name: "ArticlePriceDisabled",
    },
    { type: "error", inputs: [], name: "NotAuthorized" },
    { type: "error", inputs: [], name: "PriceCannotBeZero" },
    {
        type: "error",
        inputs: [
            { name: "priceIndex", internalType: "uint256", type: "uint256" },
        ],
        name: "PriceIndexOutOfBound",
    },
    { type: "error", inputs: [], name: "RenounceForCallerOnly" },
] as const;

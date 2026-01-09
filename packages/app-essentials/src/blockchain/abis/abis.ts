//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CampaignBank
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const campaignBankAbi = [
    { type: "constructor", inputs: [], stateMutability: "nonpayable" },
    {
        type: "function",
        inputs: [],
        name: "REWARDER_HUB",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "cancelOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "pendingOwner", internalType: "address", type: "address" },
        ],
        name: "completeOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "_token", internalType: "address", type: "address" },
            { name: "_amount", internalType: "uint256", type: "uint256" },
        ],
        name: "deposit",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [{ name: "_token", internalType: "address", type: "address" }],
        name: "getBalance",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
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
        name: "hasAllRoles",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "user", internalType: "address", type: "address" },
            { name: "roles", internalType: "uint256", type: "uint256" },
        ],
        name: "hasAnyRole",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_owner", internalType: "address", type: "address" },
            { name: "_rewarderHub", internalType: "address", type: "address" },
        ],
        name: "init",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [
            { name: "pendingOwner", internalType: "address", type: "address" },
        ],
        name: "ownershipHandoverExpiresAt",
        outputs: [{ name: "result", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "renounceOwnership",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "roles", internalType: "uint256", type: "uint256" }],
        name: "renounceRoles",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "requestOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "_token", internalType: "address", type: "address" }],
        name: "revokeAllowance",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_tokens", internalType: "address[]", type: "address[]" },
        ],
        name: "revokeAllowances",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [{ name: "_isOpen", internalType: "bool", type: "bool" }],
        name: "setOpen",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "newOwner", internalType: "address", type: "address" },
        ],
        name: "transferOwnership",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "_token", internalType: "address", type: "address" },
            { name: "_amount", internalType: "uint256", type: "uint256" },
        ],
        name: "updateAllowance",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_tokens", internalType: "address[]", type: "address[]" },
            { name: "_amounts", internalType: "uint256[]", type: "uint256[]" },
        ],
        name: "updateAllowances",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_token", internalType: "address", type: "address" },
            { name: "_amount", internalType: "uint256", type: "uint256" },
            { name: "_to", internalType: "address", type: "address" },
        ],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "token",
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
        name: "AllowanceUpdated",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "isOpen",
                internalType: "bool",
                type: "bool",
                indexed: false,
            },
        ],
        name: "BankStateUpdated",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "token",
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
        name: "Deposited",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "version",
                internalType: "uint64",
                type: "uint64",
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
                name: "pendingOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipHandoverCanceled",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "pendingOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipHandoverRequested",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "oldOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "newOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipTransferred",
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
                name: "roles",
                internalType: "uint256",
                type: "uint256",
                indexed: true,
            },
        ],
        name: "RolesUpdated",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "token",
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
                name: "to",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "Withdrawn",
    },
    { type: "error", inputs: [], name: "AlreadyInitialized" },
    { type: "error", inputs: [], name: "BankIsClosed" },
    { type: "error", inputs: [], name: "BankIsStillOpen" },
    { type: "error", inputs: [], name: "InvalidAddress" },
    { type: "error", inputs: [], name: "InvalidInitialization" },
    { type: "error", inputs: [], name: "NewOwnerIsZeroAddress" },
    { type: "error", inputs: [], name: "NoHandoverRequest" },
    { type: "error", inputs: [], name: "NotInitializing" },
    { type: "error", inputs: [], name: "Unauthorized" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CampaignBankFactory
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const campaignBankFactoryAbi = [
    {
        type: "constructor",
        inputs: [
            { name: "_rewarderHub", internalType: "address", type: "address" },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "IMPLEMENTATION",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "REWARDER_HUB",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
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
    { type: "error", inputs: [], name: "InvalidOwner" },
    { type: "error", inputs: [], name: "InvalidRewarderHub" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RewarderHub
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const rewarderHubAbi = [
    { type: "constructor", inputs: [], stateMutability: "nonpayable" },
    {
        type: "function",
        inputs: [
            {
                name: "_ops",
                internalType: "struct RewardOp[]",
                type: "tuple[]",
                components: [
                    { name: "isLock", internalType: "bool", type: "bool" },
                    {
                        name: "target",
                        internalType: "bytes32",
                        type: "bytes32",
                    },
                    {
                        name: "amount",
                        internalType: "uint256",
                        type: "uint256",
                    },
                    { name: "token", internalType: "address", type: "address" },
                    { name: "bank", internalType: "address", type: "address" },
                    {
                        name: "attestation",
                        internalType: "bytes",
                        type: "bytes",
                    },
                ],
            },
        ],
        name: "batch",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "cancelOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "_token", internalType: "address", type: "address" }],
        name: "claim",
        outputs: [
            { name: "claimed", internalType: "uint256", type: "uint256" },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_tokens", internalType: "address[]", type: "address[]" },
        ],
        name: "claimBatch",
        outputs: [
            { name: "claimed", internalType: "uint256[]", type: "uint256[]" },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "pendingOwner", internalType: "address", type: "address" },
        ],
        name: "completeOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            { name: "_wallet", internalType: "address", type: "address" },
            { name: "_token", internalType: "address", type: "address" },
        ],
        name: "getClaimable",
        outputs: [{ name: "amount", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_userId", internalType: "bytes32", type: "bytes32" },
            { name: "_token", internalType: "address", type: "address" },
        ],
        name: "getLocked",
        outputs: [{ name: "amount", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_userId", internalType: "bytes32", type: "bytes32" }],
        name: "getLockedTokens",
        outputs: [{ name: "", internalType: "address[]", type: "address[]" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_userId", internalType: "bytes32", type: "bytes32" }],
        name: "getResolution",
        outputs: [{ name: "wallet", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
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
        name: "hasAllRoles",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "user", internalType: "address", type: "address" },
            { name: "roles", internalType: "uint256", type: "uint256" },
        ],
        name: "hasAnyRole",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_owner", internalType: "address", type: "address" }],
        name: "init",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            { name: "_userId", internalType: "bytes32", type: "bytes32" },
            { name: "_amount", internalType: "uint256", type: "uint256" },
            { name: "_token", internalType: "address", type: "address" },
            { name: "_bank", internalType: "address", type: "address" },
            { name: "_attestation", internalType: "bytes", type: "bytes" },
        ],
        name: "lockReward",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [
            { name: "pendingOwner", internalType: "address", type: "address" },
        ],
        name: "ownershipHandoverExpiresAt",
        outputs: [{ name: "result", internalType: "uint256", type: "uint256" }],
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
            { name: "_wallet", internalType: "address", type: "address" },
            { name: "_amount", internalType: "uint256", type: "uint256" },
            { name: "_token", internalType: "address", type: "address" },
            { name: "_bank", internalType: "address", type: "address" },
            { name: "_attestation", internalType: "bytes", type: "bytes" },
        ],
        name: "pushReward",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_ops",
                internalType: "struct RecoverOp[]",
                type: "tuple[]",
                components: [
                    {
                        name: "userId",
                        internalType: "bytes32",
                        type: "bytes32",
                    },
                    { name: "token", internalType: "address", type: "address" },
                ],
            },
        ],
        name: "recoverLocked",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "renounceOwnership",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [{ name: "roles", internalType: "uint256", type: "uint256" }],
        name: "renounceRoles",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [],
        name: "requestOwnershipHandover",
        outputs: [],
        stateMutability: "payable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_ops",
                internalType: "struct ResolveOp[]",
                type: "tuple[]",
                components: [
                    {
                        name: "userId",
                        internalType: "bytes32",
                        type: "bytes32",
                    },
                    {
                        name: "wallet",
                        internalType: "address",
                        type: "address",
                    },
                ],
            },
        ],
        name: "resolveUserIds",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [
            { name: "newOwner", internalType: "address", type: "address" },
        ],
        name: "transferOwnership",
        outputs: [],
        stateMutability: "payable",
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
                name: "version",
                internalType: "uint64",
                type: "uint64",
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
                name: "userId",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
            {
                name: "token",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
            {
                name: "to",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "LockedRecovered",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "pendingOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipHandoverCanceled",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "pendingOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipHandoverRequested",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "oldOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "newOwner",
                internalType: "address",
                type: "address",
                indexed: true,
            },
        ],
        name: "OwnershipTransferred",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "wallet",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "token",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "RewardClaimed",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "userId",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
            {
                name: "token",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "bank",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
            {
                name: "attestation",
                internalType: "bytes",
                type: "bytes",
                indexed: false,
            },
        ],
        name: "RewardLocked",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "wallet",
                internalType: "address",
                type: "address",
                indexed: true,
            },
            {
                name: "token",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "bank",
                internalType: "address",
                type: "address",
                indexed: false,
            },
            {
                name: "amount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
            {
                name: "attestation",
                internalType: "bytes",
                type: "bytes",
                indexed: false,
            },
        ],
        name: "RewardPushed",
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
                name: "roles",
                internalType: "uint256",
                type: "uint256",
                indexed: true,
            },
        ],
        name: "RolesUpdated",
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
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "userId",
                internalType: "bytes32",
                type: "bytes32",
                indexed: true,
            },
            {
                name: "wallet",
                internalType: "address",
                type: "address",
                indexed: false,
            },
        ],
        name: "UserIdResolved",
    },
    { type: "error", inputs: [], name: "AlreadyInitialized" },
    { type: "error", inputs: [], name: "AlreadyResolved" },
    { type: "error", inputs: [], name: "CannotRecoverResolved" },
    { type: "error", inputs: [], name: "IndexOutOfBounds" },
    { type: "error", inputs: [], name: "InvalidAddress" },
    { type: "error", inputs: [], name: "InvalidAmount" },
    { type: "error", inputs: [], name: "InvalidInitialization" },
    { type: "error", inputs: [], name: "NewOwnerIsZeroAddress" },
    { type: "error", inputs: [], name: "NoHandoverRequest" },
    { type: "error", inputs: [], name: "NotInitializing" },
    { type: "error", inputs: [], name: "NothingToClaim" },
    { type: "error", inputs: [], name: "NothingToRecover" },
    { type: "error", inputs: [], name: "Reentrancy" },
    { type: "error", inputs: [], name: "Unauthorized" },
    { type: "error", inputs: [], name: "UnauthorizedCallContext" },
    { type: "error", inputs: [], name: "UpgradeFailed" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ProductInteractionDiamond
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const productInteractionDiamondAbi = [
    {
        type: "function",
        inputs: [],
        name: "getCampaigns",
        outputs: [
            {
                name: "",
                internalType: "contract InteractionCampaign[]",
                type: "address[]",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getReferralTree",
        outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
        stateMutability: "view",
    },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ProductInteractionManager
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const productInteractionManagerAbi = [
    {
        type: "function",
        inputs: [
            {
                name: "_productId",
                internalType: "uint256",
                type: "uint256",
            },
        ],
        name: "getInteractionContract",
        outputs: [
            {
                name: "",
                internalType: "contract ProductInteractionDiamond",
                type: "address",
            },
        ],
        stateMutability: "view",
    },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// InteractionCampaign
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const interactionCampaignAbi = [
    {
        type: "function",
        inputs: [],
        name: "getLink",
        outputs: [
            { name: "productId", internalType: "uint256", type: "uint256" },
            {
                name: "interactionContract",
                internalType: "address",
                type: "address",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getMetadata",
        outputs: [
            { name: "_type", internalType: "string", type: "string" },
            { name: "version", internalType: "string", type: "string" },
            { name: "name", internalType: "bytes32", type: "bytes32" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_data", internalType: "bytes", type: "bytes" }],
        name: "handleInteraction",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "isActive",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isRunning",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_isRunning", internalType: "bool", type: "bool" }],
        name: "setRunningStatus",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_productType",
                internalType: "ProductTypes",
                type: "uint256",
            },
        ],
        name: "supportProductType",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    { type: "error", inputs: [], name: "InactiveCampaign" },
    { type: "error", inputs: [], name: "Reentrancy" },
    { type: "error", inputs: [], name: "Unauthorized" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ReferralCampaign
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const referralCampaignAbi = [
    {
        type: "constructor",
        inputs: [
            {
                name: "_config",
                internalType: "struct ReferralCampaignConfig",
                type: "tuple",
                components: [
                    { name: "name", internalType: "bytes32", type: "bytes32" },
                    {
                        name: "campaignBank",
                        internalType: "contract CampaignBank",
                        type: "address",
                    },
                    {
                        name: "triggers",
                        internalType: "struct ReferralCampaignTriggerConfig[]",
                        type: "tuple[]",
                        components: [
                            {
                                name: "interactionType",
                                internalType: "InteractionType",
                                type: "bytes4",
                            },
                            {
                                name: "baseReward",
                                internalType: "uint256",
                                type: "uint256",
                            },
                            {
                                name: "userPercent",
                                internalType: "uint256",
                                type: "uint256",
                            },
                            {
                                name: "deperditionPerLevel",
                                internalType: "uint256",
                                type: "uint256",
                            },
                            {
                                name: "maxCountPerUser",
                                internalType: "uint256",
                                type: "uint256",
                            },
                        ],
                    },
                    {
                        name: "capConfig",
                        internalType: "struct ReferralCampaign.CapConfig",
                        type: "tuple",
                        components: [
                            {
                                name: "period",
                                internalType: "uint48",
                                type: "uint48",
                            },
                            {
                                name: "amount",
                                internalType: "uint208",
                                type: "uint208",
                            },
                        ],
                    },
                    {
                        name: "activationPeriod",
                        internalType:
                            "struct ReferralCampaign.ActivationPeriod",
                        type: "tuple",
                        components: [
                            {
                                name: "start",
                                internalType: "uint48",
                                type: "uint48",
                            },
                            {
                                name: "end",
                                internalType: "uint48",
                                type: "uint48",
                            },
                        ],
                    },
                ],
            },
            {
                name: "_referralRegistry",
                internalType: "contract ReferralRegistry",
                type: "address",
            },
            {
                name: "_productAdministratorRegistry",
                internalType: "contract ProductAdministratorRegistry",
                type: "address",
            },
            {
                name: "_interaction",
                internalType: "contract ProductInteractionDiamond",
                type: "address",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "getConfig",
        outputs: [
            {
                name: "capConfig",
                internalType: "struct ReferralCampaign.CapConfig",
                type: "tuple",
                components: [
                    { name: "period", internalType: "uint48", type: "uint48" },
                    {
                        name: "amount",
                        internalType: "uint208",
                        type: "uint208",
                    },
                ],
            },
            {
                name: "activationPeriod",
                internalType: "struct ReferralCampaign.ActivationPeriod",
                type: "tuple",
                components: [
                    { name: "start", internalType: "uint48", type: "uint48" },
                    { name: "end", internalType: "uint48", type: "uint48" },
                ],
            },
            {
                name: "bank",
                internalType: "contract CampaignBank",
                type: "address",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getLink",
        outputs: [
            { name: "productId", internalType: "uint256", type: "uint256" },
            {
                name: "interactionContract",
                internalType: "address",
                type: "address",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getMetadata",
        outputs: [
            { name: "_type", internalType: "string", type: "string" },
            { name: "version", internalType: "string", type: "string" },
            { name: "name", internalType: "bytes32", type: "bytes32" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_data", internalType: "bytes", type: "bytes" }],
        name: "handleInteraction",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "isActive",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isRunning",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [{ name: "_isRunning", internalType: "bool", type: "bool" }],
        name: "setRunningStatus",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_productType",
                internalType: "ProductTypes",
                type: "uint256",
            },
        ],
        name: "supportProductType",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "pure",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_activationPeriod",
                internalType: "struct ReferralCampaign.ActivationPeriod",
                type: "tuple",
                components: [
                    { name: "start", internalType: "uint48", type: "uint48" },
                    { name: "end", internalType: "uint48", type: "uint48" },
                ],
            },
        ],
        name: "updateActivationPeriod",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [
            {
                name: "_capConfig",
                internalType: "struct ReferralCampaign.CapConfig",
                type: "tuple",
                components: [
                    { name: "period", internalType: "uint48", type: "uint48" },
                    {
                        name: "amount",
                        internalType: "uint208",
                        type: "uint208",
                    },
                ],
            },
        ],
        name: "updateCapConfig",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "event",
        anonymous: false,
        inputs: [
            {
                name: "previousTimestamp",
                internalType: "uint48",
                type: "uint48",
                indexed: false,
            },
            {
                name: "distributedAmount",
                internalType: "uint256",
                type: "uint256",
                indexed: false,
            },
        ],
        name: "DistributionCapReset",
    },
    { type: "error", inputs: [], name: "DistributionCapReached" },
    { type: "error", inputs: [], name: "InactiveCampaign" },
    { type: "error", inputs: [], name: "InvalidConfig" },
    { type: "error", inputs: [], name: "Reentrancy" },
    { type: "error", inputs: [], name: "Unauthorized" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AffiliationCampaign (Fixed & Range) - has RewardChainingConfig in getConfig
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const affiliationCampaignAbi = [
    {
        type: "function",
        inputs: [],
        name: "getConfig",
        outputs: [
            {
                name: "capConfig",
                internalType: "struct CapConfig",
                type: "tuple",
                components: [
                    { name: "period", internalType: "uint48", type: "uint48" },
                    {
                        name: "amount",
                        internalType: "uint208",
                        type: "uint208",
                    },
                ],
            },
            {
                name: "activationPeriod",
                internalType: "struct ActivationPeriod",
                type: "tuple",
                components: [
                    { name: "start", internalType: "uint48", type: "uint48" },
                    { name: "end", internalType: "uint48", type: "uint48" },
                ],
            },
            {
                name: "bank",
                internalType: "contract CampaignBank",
                type: "address",
            },
            {
                name: "chainingConfig",
                internalType: "struct RewardChainingConfig",
                type: "tuple",
                components: [
                    {
                        name: "userPercent",
                        internalType: "uint256",
                        type: "uint256",
                    },
                    {
                        name: "deperditionPerLevel",
                        internalType: "uint256",
                        type: "uint256",
                    },
                ],
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getMetadata",
        outputs: [
            { name: "_type", internalType: "string", type: "string" },
            { name: "version", internalType: "string", type: "string" },
            { name: "name", internalType: "bytes32", type: "bytes32" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isActive",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isRunning",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CampaignBank (legacy v1)
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const legacyCampaignBankAbi = [
    {
        type: "function",
        inputs: [],
        name: "getToken",
        outputs: [{ name: "", internalType: "address", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "isDistributionEnabled",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [
            { name: "_campaign", internalType: "address", type: "address" },
        ],
        name: "isCampaignAuthorised",
        outputs: [{ name: "", internalType: "bool", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getTotalPending",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
    },
] as const;

/**
 * A referral campaign id
 */
export const affiliationRangeCampaignId = "0xf1a57c61" as const;

/**
 * The abi struct used for the referral campaign config
 */
export const affiliationRangeCampaignConfigStruct = [
    { name: "name", internalType: "bytes32", type: "bytes32" },
    {
        name: "campaignBank",
        internalType: "contract CampaignBank",
        type: "address",
    },
    {
        name: "capConfig",
        internalType: "struct CapConfig",
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
        internalType: "struct ActivationPeriod",
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
    {
        name: "triggers",
        internalType: "struct RangeAffiliationTriggerConfig[]",
        type: "tuple[]",
        components: [
            {
                name: "interactionType",
                internalType: "InteractionType",
                type: "bytes4",
            },
            {
                name: "maxCountPerUser",
                internalType: "uint256",
                type: "uint256",
            },
            {
                name: "startReward",
                internalType: "uint256",
                type: "uint256",
            },
            {
                name: "endReward",
                internalType: "uint256",
                type: "uint256",
            },
            {
                name: "percentBeta",
                internalType: "uint256",
                type: "uint256",
            },
        ],
    },
] as const;

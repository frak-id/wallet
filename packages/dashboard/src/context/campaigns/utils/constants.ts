/**
 * A referral campaign id
 */
export const referralCampaignId = "0x1a8750ce" as const;

/**
 * The abi struct used for the referral campaign config
 */
export const referralConfigStruct = [
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
        internalType: "struct ReferralCampaign.ActivationPeriod",
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
] as const;

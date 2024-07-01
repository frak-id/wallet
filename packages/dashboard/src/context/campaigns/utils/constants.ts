/**
 * A referral campaign id
 */
export const referralCampaignId = "0x1a8750ce" as const;

/**
 * The abi struct used for the referral campaign config
 */
export const referralConfigStruct = [
    { name: "token", internalType: "address", type: "address" },
    { name: "referralTree", internalType: "bytes32", type: "bytes32" },
    { name: "initialReward", internalType: "uint256", type: "uint256" },
    {
        name: "userRewardPercent",
        internalType: "uint256",
        type: "uint256",
    },
    {
        name: "distributionCapPeriod",
        internalType: "uint256",
        type: "uint256",
    },
    { name: "distributionCap", internalType: "uint256", type: "uint256" },
    { name: "startDate", internalType: "uint48", type: "uint48" },
    { name: "endDate", internalType: "uint48", type: "uint48" },
] as const;

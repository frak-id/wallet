export const referralCampaign_isActive = {
    type: "function",
    inputs: [],
    name: "isActive",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
} as const;

export const campaignBankFactory_deployCampaignBank = {
    type: "function",
    inputs: [
        { name: "_productId", internalType: "uint256", type: "uint256" },
        { name: "_token", internalType: "address", type: "address" },
    ],
    name: "deployCampaignBank",
    outputs: [
        {
            name: "campaignBank",
            internalType: "contract CampaignBank",
            type: "address",
        },
    ],
    stateMutability: "nonpayable",
} as const;

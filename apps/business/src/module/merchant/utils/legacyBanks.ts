import type { Address, Hex } from "viem";

/**
 * Map of productId to old campaign bank address for merchants
 * that still have undrained funds in the legacy bank system.
 *
 * These banks use a different contract (single-token PushPullModule)
 * and need manual migration to the new multi-token CampaignBank.
 */
export const legacyBankMap: Record<Hex, Address> = {
    // gapianne.com
    "0xbefe088a272c69bd4a643f2270dbd67c046cded7485a100c5dbd4dc87f651cd3":
        "0xd4aA0fC3cfcDa57a65607D22a8Ea03F75F699145",
    // morning-marvels.com
    "0x28727f8f3b7a0d469705a44da249cad1772762ef73e59cca7f3f2125af059745":
        "0x9414a13469D0D08e05F595275B5b3F6439628DdE",
    // wyvesurf.com
    "0xa2864f05599aa7cc38cb2ce19692599011300c2c90528090673b1cf6fbfab8bb":
        "0x2E1119d0e32990B9611c0e930c8279F7CA732De2",
    // saintlazare.fr
    "0x849d4885b33e6bba1baf1325ef207ed066c935cb691e5f632572bbbb6262f189":
        "0x809e580da41223966684Db5c8b8e0fB942F03f9e",
};

/**
 * Minimal ABI for the legacy CampaignBank contract (PushPullModule-based).
 * Only includes functions needed for the migration flow:
 * - Reading: token address, pending rewards, distribution state, balance
 * - Writing: close bank, withdraw excess funds
 */
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
        name: "getConfig",
        outputs: [
            { name: "productId", internalType: "uint256", type: "uint256" },
            { name: "token", internalType: "address", type: "address" },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        inputs: [],
        name: "getTotalPending",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
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
        inputs: [{ name: "_state", internalType: "bool", type: "bool" }],
        name: "updateDistributionState",
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        inputs: [],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;

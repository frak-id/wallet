import type { Address } from "viem";
import type { IndexerToken } from "./common";

export type GetCampaignResponseDto = {
    campaigns: {
        address: Address;
        type: string;
        name: string;
        version: string;
        productId: string; // string representing a bigint
        attached: boolean;
        banking: Address;
        token: Address;
    }[];
    tokens: IndexerToken[];
};

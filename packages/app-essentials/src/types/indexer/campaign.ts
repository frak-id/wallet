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
        lastUpdateBlock: string; // string representing a bigint
    }[];
    tokens: IndexerToken[];
};

export type GetAdminCampaignsResponseDto = {
    productId: string;
    isOwner: boolean;
    id: Address;
    name: string;
    version: string;
    attached: boolean;
    // bigint, time in second
    attachTimestamp: string;
    detachTimestamp?: string | null;
}[];

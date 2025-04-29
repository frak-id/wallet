import type { Address } from "viem";

export type GetAllProductsResponseDto = {
    id: string; // bigint under the hood
    domain: string;
    name: string;
    productTypes: string; // bigint under the hood
    createTimestamp: string; // bigint (timestamp)
}[];

export type GetProductInfoResponseDto = {
    product: {
        id: string;
        domain: string;
        productTypes: string;
        name: string;
        createTimestamp: string;
        lastUpdateTimestamp: string | null;
        lastUpdateBlock: string;
        metadataUrl: string;
    };
    banks: {
        id: Address;
        tokenId: Address;
        productId: string;
        totalDistributed: string;
        totalClaimed: string;
        isDistributing: boolean;
    }[];
    interactionContracts: {
        id: Address;
        productId: string;
        referralTree: string;
        lastUpdateBlock: string;
        createdTimestamp: string;
        lastUpdateTimestamp: string;
        removedTimestamp: string | null;
    }[];
    administrators: {
        productId: string;
        isOwner: boolean;
        roles: string;
        user: string;
        createdTimestamp: string;
    }[];
    campaigns: {
        id: Address;
        type: string;
        name: string;
        version: string;
        productId: string;
        interactionContractId: string;
        attached: boolean;
        lastUpdateBlock: string;
        attachTimestamp: string;
        detachTimestamp: string | null;
        bankingContractId: Address;
        isAuthorisedOnBanking: boolean;
    }[];
    campaignStats: {
        campaignId: Address;
        totalInteractions: string;
        openInteractions: string;
        readInteractions: string;
        referredInteractions: string;
        createReferredLinkInteractions: string;
        purchaseStartedInteractions: string;
        purchaseCompletedInteractions: string;
        webshopOpenned: string;
        customerMeetingInteractions: string;
        totalRewards: string;
        rewardCount: string;
    }[];
};

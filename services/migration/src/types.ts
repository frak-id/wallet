import type { CampaignRuleInsert } from "@backend/domain/campaign/db/schema";
import type { CampaignRuleDefinition } from "@backend/domain/campaign/schemas";
import type {
    MerchantAdminInsert,
    MerchantInsert,
} from "@backend/domain/merchant/db/schema";
import type { Address, Hex } from "viem";

export type V2MerchantInsert = MerchantInsert;
export type V2MerchantAdminInsert = MerchantAdminInsert;
export type V2CampaignRuleInsert = CampaignRuleInsert;
export type V2CampaignRuleDefinition = CampaignRuleDefinition;

export type V1IndexerProduct = {
    id: string;
    domain: string;
    name: string;
    productTypes: string;
    createTimestamp: string;
};

export type V1IndexerProductInfo = {
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
    administrators: V1IndexerAdministrator[];
    campaigns: V1IndexerCampaign[];
    campaignStats: {
        campaignId: Address;
        totalInteractions: string;
        totalRewards: string;
        rewardCount: string;
    }[];
};

export type V1IndexerAdministrator = {
    productId: string;
    isOwner: boolean;
    roles: string;
    user: Address;
    createdTimestamp: string;
};

export type V1IndexerCampaign = {
    id: Address;
    type: string;
    name: string;
    version: string;
    productId: string;
    interactionContractId: Address;
    attached: boolean;
    lastUpdateBlock: string;
    attachTimestamp: string;
    detachTimestamp: string | null;
    bankingContractId: Address;
    isAuthorisedOnBanking: boolean;
};

export type V1MongoDBCampaign = {
    _id: string;
    creator: Address;
    productId: Hex | "";
    title: string;
    type: "awareness" | "traffic" | "registration" | "sales" | "retention" | "";
    specialCategories: ("credit" | "jobs" | "housing" | "social")[];
    budget: {
        type: "daily" | "weekly" | "monthly" | "global" | undefined;
        maxEuroDaily: number;
    };
    territories: string[];
    bank: Address | "";
    scheduled?: {
        dateStart: Date;
        dateEnd?: Date;
    };
    rewardChaining?: {
        userPercent?: number;
        deperditionPerLevel?: number;
    };
    distribution?:
        | { type: "fixed" }
        | { type: "range"; minMultiplier: number; maxMultiplier: number };
    triggers: Record<
        string,
        | { cac: number; maxCountPerUser?: number }
        | { from: number; to: number; maxCountPerUser?: number }
    >;
    setupCurrency?: "eur" | "usd" | "gbp" | "raw";
    state:
        | { key: "draft" }
        | { key: "creationFailed" }
        | { key: "created"; txHash: Hex; address: Address };
};

export type OnChainCampaignData = {
    campaignAddress: Address;
    productId: string;
    isRunning: boolean;
    isActive: boolean;
    campaignType: string;
    campaignVersion: string;
    campaignName: string;
    capConfig: {
        period: bigint;
        amount: bigint;
    };
    activationPeriod: {
        start: bigint;
        end: bigint;
    };
    bankAddress: Address;
    chainingConfig?: {
        userPercent: bigint;
        deperditionPerLevel: bigint;
    };
};

export type MigrationAction =
    | { type: "create_merchant"; data: V2MerchantInsert }
    | { type: "deploy_bank"; merchantId: string; ownerWallet: Address }
    | { type: "create_merchant_admin"; data: V2MerchantAdminInsert }
    | {
          type: "create_campaign_rule";
          data: V2CampaignRuleInsert;
          productOrigin?: { productId: string; productDomain: string };
          onChainCampaignAddress?: Address;
      };

export type ExcludedProduct = {
    domain: string;
    matchedPattern: string;
};

export type BankBalanceInfo = {
    productDomain: string;
    productId: string;
    bankAddress: Address;
    tokenAddress: Address;
    balance: bigint;
    formattedBalance: string;
};

export type MigrationPlan = {
    merchants: MigrationAction[];
    admins: MigrationAction[];
    campaigns: MigrationAction[];
    excludedProducts: ExcludedProduct[];
    banksWithBalance: BankBalanceInfo[];
    onChainCampaigns: Map<Address, OnChainCampaignData>;
    summary: {
        totalMerchants: number;
        totalBanksToDeploy: number;
        totalAdmins: number;
        totalCampaignRules: number;
    };
};

export type MigrationResult = {
    success: boolean;
    merchantsCreated: number;
    banksDeployed: number;
    adminsCreated: number;
    campaignRulesCreated: number;
    errors: string[];
};

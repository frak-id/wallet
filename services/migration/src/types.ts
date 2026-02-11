import type { Address, Hex } from "viem";

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

export type V2MerchantInsert = {
    productId: Hex;
    domain: string;
    name: string;
    ownerWallet: Address;
    bankAddress?: Address;
    defaultRewardToken: Address;
    verifiedAt?: Date;
    createdAt?: Date;
};

export type V2MerchantAdminInsert = {
    merchantId: string;
    wallet: Address;
    addedBy: Address;
    addedAt?: Date;
};

export type V2CampaignRuleInsert = {
    merchantId: string;
    name: string;
    status: "draft" | "active" | "paused" | "archived";
    priority: number;
    rule: {
        trigger: "purchase" | "referral_link" | "create_referral_link";
        conditions: unknown[];
        rewards: unknown[];
        pendingRewardExpirationDays?: number;
    };
    metadata?: {
        goal?: "awareness" | "traffic" | "registration" | "sales" | "retention";
        specialCategories?: ("credit" | "jobs" | "housing" | "social")[];
        territories?: string[];
    };
    budgetConfig?: {
        label: string;
        durationInSeconds: number | null;
        amount: number;
    }[];
    expiresAt?: Date;
    publishedAt?: Date;
};

export type MigrationAction =
    | { type: "create_merchant"; data: V2MerchantInsert }
    | { type: "deploy_bank"; merchantId: string; ownerWallet: Address }
    | { type: "create_merchant_admin"; data: V2MerchantAdminInsert }
    | {
          type: "create_campaign_rule";
          data: V2CampaignRuleInsert;
          productOrigin?: { productId: string; productDomain: string };
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

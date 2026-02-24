import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import type { Address, Hex } from "viem";
import { erc20Abi, formatUnits, hexToString, trim } from "viem";
import { multicall } from "viem/actions";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import {
    affiliationCampaignAbi,
    interactionCampaignAbi,
    referralCampaignAbi,
} from "../abis/campaignAbis";
import type {
    BankBalanceInfo,
    OnChainCampaignData,
    V1IndexerCampaign,
    V1IndexerProductInfo,
} from "../types";

const viemClient = getViemClientFromChain({
    chain: isRunningInProd ? arbitrum : arbitrumSepolia,
});

const LEGACY_CAMPAIGN_TYPE = "frak.campaign.referral";
const BASIS_POINTS_DIVISOR = 10_000n;

export async function fetchBankBalances(
    products: V1IndexerProductInfo[]
): Promise<BankBalanceInfo[]> {
    const banksToCheck: {
        bankAddress: Address;
        tokenAddress: Address;
        productDomain: string;
        productId: string;
    }[] = [];

    for (const product of products) {
        for (const bank of product.banks) {
            banksToCheck.push({
                bankAddress: bank.id,
                tokenAddress: bank.tokenId,
                productDomain: product.product.domain,
                productId: product.product.id,
            });
        }
    }

    if (banksToCheck.length === 0) return [];

    const results = await multicall(viemClient, {
        contracts: banksToCheck.map(
            ({ bankAddress, tokenAddress }) =>
                ({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: "balanceOf",
                    args: [bankAddress],
                }) as const
        ),
    });

    const banksWithBalance: BankBalanceInfo[] = [];
    for (let i = 0; i < results.length; i++) {
        const { result, status } = results[i];
        const bank = banksToCheck[i];

        if (status === "failure" || !result) continue;

        const balance = result as bigint;
        if (balance > 0n) {
            banksWithBalance.push({
                productDomain: bank.productDomain,
                productId: bank.productId,
                bankAddress: bank.bankAddress,
                tokenAddress: bank.tokenAddress,
                balance,
                formattedBalance: formatUnits(balance, 6),
            });
        }
    }

    return banksWithBalance;
}

type CampaignWithContext = {
    campaign: V1IndexerCampaign;
    productId: string;
};

export async function fetchOnChainCampaignData(
    products: V1IndexerProductInfo[]
): Promise<Map<Address, OnChainCampaignData>> {
    const allCampaigns: CampaignWithContext[] = [];
    for (const product of products) {
        for (const campaign of product.campaigns) {
            allCampaigns.push({
                campaign,
                productId: product.product.id,
            });
        }
    }

    if (allCampaigns.length === 0) return new Map();

    const baseData = await fetchCampaignBaseData(allCampaigns);
    const configData = await fetchCampaignConfigs(allCampaigns, baseData);

    return mergeCampaignData(allCampaigns, baseData, configData);
}

type CampaignBaseData = {
    isRunning: boolean;
    isActive: boolean;
    campaignType: string;
    campaignVersion: string;
    campaignName: string;
};

async function fetchCampaignBaseData(
    campaigns: CampaignWithContext[]
): Promise<CampaignBaseData[]> {
    const contracts = campaigns.flatMap(({ campaign }) => [
        {
            address: campaign.id,
            abi: interactionCampaignAbi,
            functionName: "isRunning" as const,
        },
        {
            address: campaign.id,
            abi: interactionCampaignAbi,
            functionName: "isActive" as const,
        },
        {
            address: campaign.id,
            abi: interactionCampaignAbi,
            functionName: "getMetadata" as const,
        },
    ]);

    const results = await multicall(viemClient, {
        contracts,
        allowFailure: true,
    });

    const baseData: CampaignBaseData[] = [];
    for (let i = 0; i < campaigns.length; i++) {
        const idx = i * 3;
        const isRunningResult = results[idx];
        const isActiveResult = results[idx + 1];
        const metadataResult = results[idx + 2];

        const isRunning =
            isRunningResult?.status === "success"
                ? (isRunningResult.result as boolean)
                : true;

        const isActive =
            isActiveResult?.status === "success"
                ? (isActiveResult.result as boolean)
                : true;

        let campaignType = campaigns[i].campaign.type;
        let campaignVersion = campaigns[i].campaign.version;
        let campaignName = campaigns[i].campaign.name;

        if (metadataResult?.status === "success") {
            const [_type, version, nameBytes] = metadataResult.result as [
                string,
                string,
                Hex,
            ];
            campaignType = _type;
            campaignVersion = version;
            campaignName = hexToString(trim(nameBytes, { dir: "right" }));
        }

        baseData.push({
            isRunning,
            isActive,
            campaignType,
            campaignVersion,
            campaignName,
        });
    }

    return baseData;
}

type CampaignConfigData = {
    capConfig: { period: bigint; amount: bigint };
    activationPeriod: { start: bigint; end: bigint };
    bankAddress: Address;
    chainingConfig?: { userPercent: bigint; deperditionPerLevel: bigint };
};

async function fetchCampaignConfigs(
    campaigns: CampaignWithContext[],
    baseData: CampaignBaseData[]
): Promise<(CampaignConfigData | null)[]> {
    const contracts = campaigns.map(({ campaign }, idx) => {
        const isLegacy = baseData[idx].campaignType === LEGACY_CAMPAIGN_TYPE;
        return {
            address: campaign.id,
            abi: isLegacy ? referralCampaignAbi : affiliationCampaignAbi,
            functionName: "getConfig" as const,
        };
    });

    const results = await multicall(viemClient, {
        contracts,
        allowFailure: true,
    });

    return results.map((result, idx) => {
        if (result.status === "failure") return null;

        const isLegacy = baseData[idx].campaignType === LEGACY_CAMPAIGN_TYPE;
        if (isLegacy) {
            const [capConfig, activationPeriod, bank] =
                result.result as readonly [
                    { period: number; amount: bigint },
                    { start: number; end: number },
                    Address,
                ];
            return {
                capConfig: {
                    period: BigInt(capConfig.period),
                    amount: capConfig.amount,
                },
                activationPeriod: {
                    start: BigInt(activationPeriod.start),
                    end: BigInt(activationPeriod.end),
                },
                bankAddress: bank,
            };
        }

        const [capConfig, activationPeriod, bank, chainingConfig] =
            result.result as readonly [
                { period: number; amount: bigint },
                { start: number; end: number },
                Address,
                { userPercent: bigint; deperditionPerLevel: bigint },
            ];
        return {
            capConfig: {
                period: BigInt(capConfig.period),
                amount: capConfig.amount,
            },
            activationPeriod: {
                start: BigInt(activationPeriod.start),
                end: BigInt(activationPeriod.end),
            },
            bankAddress: bank,
            chainingConfig,
        };
    });
}

function mergeCampaignData(
    campaigns: CampaignWithContext[],
    baseData: CampaignBaseData[],
    configData: (CampaignConfigData | null)[]
): Map<Address, OnChainCampaignData> {
    const result = new Map<Address, OnChainCampaignData>();

    for (let i = 0; i < campaigns.length; i++) {
        const { campaign, productId } = campaigns[i];
        const base = baseData[i];
        const config = configData[i];

        result.set(campaign.id, {
            campaignAddress: campaign.id,
            productId,
            isRunning: base.isRunning,
            isActive: base.isActive,
            campaignType: base.campaignType,
            campaignVersion: base.campaignVersion,
            campaignName: base.campaignName,
            capConfig: config?.capConfig ?? { period: 0n, amount: 0n },
            activationPeriod: config?.activationPeriod ?? {
                start: 0n,
                end: 0n,
            },
            bankAddress: config?.bankAddress ?? campaign.bankingContractId,
            chainingConfig: config?.chainingConfig,
        });
    }

    return result;
}

export function onChainChainingToDecimals(chainingConfig: {
    userPercent: bigint;
    deperditionPerLevel: bigint;
}): { userPercent: number; deperditionPerLevel: number } {
    return {
        userPercent:
            Number(chainingConfig.userPercent) / Number(BASIS_POINTS_DIVISOR),
        deperditionPerLevel:
            Number(chainingConfig.deperditionPerLevel) /
            Number(BASIS_POINTS_DIVISOR),
    };
}

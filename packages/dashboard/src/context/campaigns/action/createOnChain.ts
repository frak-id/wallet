"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { viemClient } from "@/context/blockchain/provider";
import { getBankTokenInfo } from "@/context/campaigns/action/getBankInfo";
import { getCapPeriod } from "@/context/campaigns/utils/capPeriods";
import {
    affiliationFixedCampaignConfigStruct,
    affiliationFixedCampaignId,
    affiliationRangeCampaignConfigStruct,
    affiliationRangeCampaignId,
} from "@/context/campaigns/utils/constants";
import type { Campaign } from "@/types/Campaign";
import {
    addresses,
    productInteractionManagerAbi,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import {
    type InteractionTypesKey,
    interactionTypes,
} from "@frak-labs/core-sdk";
import ky from "ky";
import {
    type Address,
    type Hex,
    concatHex,
    encodeAbiParameters,
    encodeFunctionData,
    isAddress,
    parseUnits,
} from "viem";
import { simulateContract } from "viem/actions";

/**
 * Function to create a new campaign
 * @param campaign
 */
export async function getCreationData(campaign: Campaign) {
    const session = await getSafeSession();
    if (!campaign.productId) {
        throw new Error("Product id is required");
    }

    // If the triggers record is empty early exit
    const hasTrigger = Object.values(campaign?.triggers ?? {}).some(
        (trigger) => "cac" in trigger && (trigger?.cac ?? 0) > 0
    );
    if (!hasTrigger) {
        throw new Error("Triggers are required");
    }

    // If the bank address isn't set, early exit
    if (!campaign.bank || !isAddress(campaign.bank)) {
        throw new Error("Bank is required");
    }

    // Compute the cap period
    const capPeriod = getCapPeriod(campaign.budget.type);

    // The start and end period
    let start = 0;
    let end = 0;
    if (campaign.scheduled?.dateStart) {
        start = Math.floor(
            new Date(campaign.scheduled.dateStart).getTime() / 1000
        );
    }
    if (campaign.scheduled?.dateEnd) {
        end = Math.floor(new Date(campaign.scheduled.dateEnd).getTime() / 1000);
    }

    // Get the token decimal count
    const { decimals: tokenDecimals, token } = await getBankTokenInfo({
        bank: campaign.bank,
    });

    // Get the token rate
    let tokenToFiatRate = 1;
    if (campaign.setupCurrency !== "raw") {
        const tokenRates = await ky
            .get(`${process.env.BACKEND_URL}/common/rate?token=${token}`)
            .json<{ eur: number; usd: number; gbp: number }>();
        if (!tokenRates) {
            throw new Error("Token rate not found");
        }
        tokenToFiatRate = campaign.setupCurrency
            ? tokenRates[campaign.setupCurrency]
            : tokenRates.eur;
    }
    const fiatToTokenMapper = (amount: number) => {
        const amountInToken = amount / tokenToFiatRate;
        return parseUnits(amountInToken.toString(), tokenDecimals);
    };

    // Build the args depending on the distribution types
    const args =
        campaign.distribution?.type === "range"
            ? getCampaignRangeArgs(campaign as Campaign & { bank: Address }, {
                  capPeriod,
                  activationPeriod: { start, end },
                  fiatToTokenMapper,
              })
            : getFixedCampaignArgs(campaign as Campaign & { bank: Address }, {
                  capPeriod,
                  activationPeriod: { start, end },
                  fiatToTokenMapper,
              });

    // Perform a contract simulation
    const { result: determinedCampaignAddress } = await simulateContract(
        viemClient,
        {
            account: session.wallet,
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "deployCampaign",
            args,
        }
    );

    // Return the encoded calldata to deploy and attach this campaign
    const creationData = encodeFunctionData({
        abi: productInteractionManagerAbi,
        functionName: "deployCampaign",
        args,
    });

    const allowRewardData = encodeFunctionData({
        abi: campaignBankAbi,
        functionName: "updateCampaignAuthorisation",
        args: [determinedCampaignAddress, true],
    });

    return {
        tx: [
            {
                to: addresses.productInteractionManager,
                data: creationData as Hex,
            },
            {
                to: campaign.bank,
                data: allowRewardData as Hex,
            },
        ],
    };
}

// todo: Ugly, should be reviewed after
function getHexValueForKey(key: InteractionTypesKey): Hex | undefined {
    for (const category in interactionTypes) {
        const categoryTyped = category as keyof typeof interactionTypes;
        // biome-ignore lint/suspicious/noExplicitAny: Will be refacto
        if ((interactionTypes[categoryTyped] as any)[key]) {
            // biome-ignore lint/suspicious/noExplicitAny: Will be refacto
            return (interactionTypes[categoryTyped] as any)[key];
        }
    }
    return undefined;
}

/* -------------------------------------------------------------------------- */
/*                           Fixed campaign specifics                         */
/* -------------------------------------------------------------------------- */

function getFixedCampaignArgs(
    campaign: Campaign & { bank: Address },
    {
        activationPeriod,
        capPeriod,
        fiatToTokenMapper,
    }: {
        activationPeriod: { start: number; end: number };
        capPeriod: number;
        fiatToTokenMapper: (amount: number) => bigint;
    }
) {
    // Get the token decimal count
    const triggers = extractFixedTriggers(campaign, fiatToTokenMapper);

    // Map the budget from eur to token rate
    let capBudget = 0n;
    if (campaign.budget.maxEuroDaily) {
        capBudget = fiatToTokenMapper(campaign.budget.maxEuroDaily);
    }

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(
        affiliationFixedCampaignConfigStruct,
        [
            stringToBytes32(campaign.title),
            campaign.bank,
            // Cap config
            {
                period: capPeriod,
                amount: capBudget,
            },
            // Activation period
            activationPeriod,
            // reward chaining config
            {
                userPercent: campaign?.rewardChaining?.userPercent
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.userPercent * 10_000
                          )
                      )
                    : 1_000n, // default to 10%
                deperditionPerLevel: campaign?.rewardChaining
                    ?.deperditionPerLevel
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.deperditionPerLevel *
                                  10_000
                          )
                      )
                    : 8_000n, // default to 80%
            },
            // Triggers
            triggers,
        ]
    );
    // Add offset to the data
    const initDataWithOffset = concatHex([
        "0x0000000000000000000000000000000000000000000000000000000000000020",
        campaignInitData,
    ]);

    return [
        BigInt(campaign.productId),
        affiliationFixedCampaignId,
        initDataWithOffset,
    ] as const;
}
/**
 * Extract the triggers from a campaign
 * @param campaign
 * @param tokenDecimals
 */
function extractFixedTriggers(
    campaign: Campaign,
    fiatToTokenMapper: (amount: number) => bigint
) {
    // Rebuild the triggers
    const triggers = Object.entries(campaign.triggers)
        .filter(([_, trigger]) => "cac" in trigger && (trigger?.cac ?? 0) > 0)
        .map(([interactionTypeKey, trigger]) => {
            // Can't happen since we got the filter, for type checking
            if (!trigger.cac) {
                throw new Error("CAC is required");
            }

            // Find the matching interaction types (into the sub-keys of interaction types)
            const interactionType = getHexValueForKey(
                interactionTypeKey as InteractionTypesKey
            );
            if (!interactionType) {
                throw new Error(
                    `No interaction type found for the key ${interactionTypeKey}`
                );
            }

            // Remove the 20% commission
            const reward = trigger.cac * 0.8;

            return {
                interactionType: interactionType,
                baseReward: fiatToTokenMapper(reward),
                maxCountPerUser: trigger.maxCountPerUser
                    ? BigInt(trigger.maxCountPerUser)
                    : 1n, // Max 1 per user
            };
        })
        // Filter out trigger with no rewards
        .filter((trigger) => trigger.baseReward > 0n);

    // Check if we got a purchase related triggers, if yes, add an unsafe ppurchase one with same criteria
    const purchaseTrigger = triggers.find(
        (trigger) =>
            trigger.interactionType === interactionTypes.purchase.completed
    );
    const hasUnsafeCompletedTrigger = triggers.some(
        (trigger) =>
            trigger.interactionType ===
            interactionTypes.purchase.unsafeCompleted
    );
    if (purchaseTrigger && !hasUnsafeCompletedTrigger) {
        triggers.push({
            ...purchaseTrigger,
            interactionType: interactionTypes.purchase.unsafeCompleted,
        });
    }

    return triggers;
}

/* -------------------------------------------------------------------------- */
/*                          Range campaign specifics                          */
/* -------------------------------------------------------------------------- */

function getCampaignRangeArgs(
    campaign: Campaign & { bank: Address },
    {
        activationPeriod,
        capPeriod,
        fiatToTokenMapper,
    }: {
        activationPeriod: { start: number; end: number };
        capPeriod: number;
        fiatToTokenMapper: (amount: number) => bigint;
    }
) {
    // Get the token decimal count
    const triggers = extractRangeTriggers(campaign, fiatToTokenMapper);

    // Map the budget from eur to token rate
    let capBudget = 0n;
    if (campaign.budget.maxEuroDaily) {
        capBudget = fiatToTokenMapper(campaign.budget.maxEuroDaily);
    }

    // Build the tx to be sent by the creator to create the given campaign
    const campaignInitData = encodeAbiParameters(
        affiliationRangeCampaignConfigStruct,
        [
            stringToBytes32(campaign.title),
            campaign.bank,
            // Cap config
            {
                period: capPeriod,
                amount: capBudget,
            },
            // Activation period
            activationPeriod,
            // reward chaining config
            {
                userPercent: campaign?.rewardChaining?.userPercent
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.userPercent * 10_000
                          )
                      )
                    : 1_000n, // default to 10%
                deperditionPerLevel: campaign?.rewardChaining
                    ?.deperditionPerLevel
                    ? BigInt(
                          Math.floor(
                              campaign.rewardChaining.deperditionPerLevel *
                                  10_000
                          )
                      )
                    : 8_000n, // default to 80%
            },
            // Triggers
            triggers,
        ]
    );
    // Add offset to the data
    const initDataWithOffset = concatHex([
        "0x0000000000000000000000000000000000000000000000000000000000000020",
        campaignInitData,
    ]);

    return [
        BigInt(campaign.productId),
        affiliationRangeCampaignId,
        initDataWithOffset,
    ] as const;
}

/**
 * Extract the triggers from a campaign
 * @param campaign
 * @param fiatToTokenMapper
 */
function extractRangeTriggers(
    campaign: Campaign,
    fiatToTokenMapper: (amount: number) => bigint
) {
    // Rebuild the triggers
    const triggers = Object.entries(campaign.triggers)
        .filter(([_, trigger]) => "cac" in trigger && (trigger?.cac ?? 0) > 0)
        .map(([interactionTypeKey, trigger]) => {
            // Can't happen since we got the filter, for type checking
            if (!trigger.cac) {
                throw new Error("CAC is required");
            }

            // Find the matching interaction types (into the sub-keys of interaction types)
            const interactionType = getHexValueForKey(
                interactionTypeKey as InteractionTypesKey
            );
            if (!interactionType) {
                throw new Error(
                    `No interaction type found for the key ${interactionTypeKey}`
                );
            }

            // Parse the amount
            const { start, end, beta } = computeRangeTriggerReward(
                trigger,
                campaign.distribution as Extract<
                    Campaign["distribution"],
                    { type: "range" }
                >
            );

            return {
                interactionType: interactionType,
                maxCountPerUser: trigger.maxCountPerUser
                    ? BigInt(trigger.maxCountPerUser)
                    : 1n, // Max 1 per user
                startReward: fiatToTokenMapper(start),
                endReward: fiatToTokenMapper(end),
                percentBeta: parseUnits(beta.toString(), 4), // on 1e4
            };
        })
        // Filter out trigger with no rewards
        .filter(
            (trigger) => trigger.startReward > 0n && trigger.endReward > 0n
        );

    // Check if we got a purchase related triggers, if yes, add an unsafe ppurchase one with same criteria
    const purchaseTrigger = triggers.find(
        (trigger) =>
            trigger.interactionType === interactionTypes.purchase.completed
    );
    const hasUnsafeCompletedTrigger = triggers.some(
        (trigger) =>
            trigger.interactionType ===
            interactionTypes.purchase.unsafeCompleted
    );
    if (purchaseTrigger && !hasUnsafeCompletedTrigger) {
        triggers.push({
            ...purchaseTrigger,
            interactionType: interactionTypes.purchase.unsafeCompleted,
        });
    }

    return triggers;
}

/**
 * Compute the range trigger reward
 *  -> Will find the right start and end offset + the beta distribution parameter for a fixed alpha
 */
function computeRangeTriggerReward(
    {
        cac,
    }: {
        cac: number;
    },
    distribution: Extract<Campaign["distribution"], { type: "range" }>
) {
    // Apply the Frak 20% commission on the born calculation
    const cacNet = cac * 0.8;

    // The start part is 0.7 the min reward
    const start = cacNet * (distribution.minMultiplier ?? 0.7);
    // The end part is to * 5 if to < 50
    const end = distribution.maxMultiplier
        ? cacNet * distribution.maxMultiplier
        : cacNet < 50
          ? cacNet * 5
          : cacNet * 3;

    // The alpha of the distribution curve is always 2
    const alpha = 2;

    // Find the beta
    const beta = (alpha * (end - cacNet)) / (cacNet - start);

    return {
        start,
        end,
        beta,
    };
}

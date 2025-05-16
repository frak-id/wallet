import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import type { TCountryCode } from "countries-list";
import type { Address, Hex } from "viem";

export type Goal =
    | "awareness"
    | "traffic"
    | "registration"
    | "sales"
    | "retention";
type SpecialCategory = "credit" | "jobs" | "housing" | "social";
export type Budget = "daily" | "weekly" | "monthly" | "global";

/**
 * The type of reward for a campaign:
 *  - fixed: Distribute a fixed amount to each users
 *  - range: Distribute a range of rewards following a beta distribution curve
 */
export type CampaignRewardType = "fixed" | "range";

export type CampaignTrigger =
    | {
          // Reward range (for the old schema)
          from: number;
          to: number;
          // Reward distribution config
          maxCountPerUser?: number;

          cac?: never;
      }
    | {
          // New schema for the trigger
          cac: number;
          maxCountPerUser?: number;

          from?: never;
          to?: never;
      };

/**
 * Direct campaign type
 */
export type Campaign = {
    id?: string;
    title: string;
    productId: Hex | "";
    type: Goal | "" | undefined;
    specialCategories: SpecialCategory[];
    // The distribution cap of the campaign
    budget: {
        type: Budget | undefined;
        maxEuroDaily: number; // Named `maxEuroDaily` but it's basicly the budget associated with the `type` period, in the fiat `setupCurrency`. We keep it that way to reduce migrations needed.
    };
    territories: TCountryCode[];
    // The campaign bank address (that will distribute rewards to the end users)
    bank: Address | "";
    // The activation period of the campaign
    scheduled?: {
        dateStart: Date;
        dateEnd?: Date;
    };
    // How is the reward chained across multiple user
    rewardChaining?: {
        userPercent?: number;
        deperditionPerLevel?: number;
    };
    // The type of distribution for the campaign
    distribution?:
        | {
              type: "fixed";
              minMultiplier?: never;
              maxMultiplier?: never;
          }
        | {
              type: "range";
              minMultiplier: number; // Between 0.7 and 1.3
              maxMultiplier: number; // Between 1 and 5
          };
    // Trigger for the campaign
    triggers: Partial<Record<InteractionTypesKey, CampaignTrigger>>;
    // The currency used to setup the campaign (if undefined, that's `eur`, if `raw` that's directly the token)
    setupCurrency?: "eur" | "usd" | "gbp" | "raw";
};

/**
 * Campaign with a state
 */
export type CampaignState =
    | {
          key: "draft";
      }
    | {
          key: "creationFailed";
      }
    | {
          key: "created";
          // Interaction link only present if blockchain campaign fetched
          interactionLink?: {
              isAttached: boolean;
              attachTimestamp: string;
              detachTimestamp?: string;
          };
          // Active = can distribute rewards
          isActive?: boolean;
          // Running = is paused or not
          isRunning?: boolean;
          // Campaign deployed address
          address: Address;
      };

export type CampaignWithState =
    | DraftCampaignWithState
    | FinalizedCampaignWithState;

export type FinalizedCampaignWithState = Campaign & {
    _id: string;
    state: Extract<CampaignState, { key: "created" | "creationFailed" }>;
    actions: {
        canEdit: boolean;
        canDelete: boolean;
        canToggleRunningStatus: boolean;
    };
};

export type DraftCampaignWithState = Partial<Campaign> & {
    _id: string;
    state: Extract<CampaignState, { key: "draft" }>;
    actions: {
        canEdit: boolean;
        canDelete: boolean;
        canToggleRunningStatus: boolean;
    };
};

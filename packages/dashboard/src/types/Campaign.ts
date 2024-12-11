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

type CampaignTrigger = {
    // Reward range
    from: number;
    to: number;
    // Reward distribution config
    userPercent?: number; // Between 0 and 1
    deperditionPerLevel?: number; // Between 0 and 1
    maxCountPerUser?: number;
};

/**
 * Direct campaign type
 */
export type Campaign = {
    id?: string;
    title: string;
    order: string;
    productId: Hex | "";
    type: Goal | "" | undefined;
    specialCategories: SpecialCategory[];
    // The distribution cap of the campaign
    budget: {
        type: Budget | "" | undefined;
        maxEuroDaily: number;
    };
    territories: TCountryCode[];
    // The campaign bank address (that will distribute rewards to the end users)
    bank: Address | "";
    // The activation period of the campaign
    scheduled?: {
        dateStart: Date;
        dateEnd?: Date;
    };
    // Trigger for the campaign
    triggers: Partial<Record<InteractionTypesKey, CampaignTrigger>>;
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

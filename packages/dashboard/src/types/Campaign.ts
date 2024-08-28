import type { TCountryCode } from "countries-list";
import type { Address, Hex } from "viem";

type Goal = "awareness" | "traffic" | "registration" | "sales" | "retention";
type SpecialCategory = "credit" | "jobs" | "housing" | "social";
type ContentType = "text" | "video" | "product" | "others";
type Budget = "daily" | "weekly" | "monthly" | "global";

/**
 * Direct campaign type
 */
export type Campaign = {
    id?: string;
    title: string;
    order: string;
    contentId: Hex | "";
    type: Goal | "" | undefined;
    specialCategories: SpecialCategory[];
    budget: {
        type: Budget | "" | undefined;
        maxEuroDaily: number;
    };
    territories: TCountryCode[];
    scheduled?: {
        dateStart: Date;
        dateEnd?: Date;
    };
    rewards: {
        click: { from: number; to: number };
        registration: { from: number; to: number };
        purchase: { from: number; to: number };
    };
    promotedContents: ContentType[];
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

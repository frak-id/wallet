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
    title: string;
    order: string;
    contentId: Hex | "";
    type: Goal | "";
    specialCategories: SpecialCategory[];
    budget: {
        type: Budget | "";
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
          interactionLink: {
              // Is campaign attached? If not, it's done for good
              isAttached: boolean;
              attachTimestamp: string;
              detachTimestamp?: string;
          };
          // Active = can distribute rewards
          isActive: boolean;
          // Campaign deployed address
          address: Address;
      };

export type CampaignWithState = Campaign & {
    _id: string;
    state: CampaignState;
    actions: {
        canEdit: boolean;
        canDelete: boolean;
    };
};

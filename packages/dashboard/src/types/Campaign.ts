import type { TCountryCode } from "countries-list";
import type { Address, Hex } from "viem";

type Goal = "awareness" | "traffic" | "registration" | "sales" | "retention";

type SpecialCategory = "credit" | "jobs" | "housing" | "social";

type ContentType = "text" | "video" | "product" | "others";

export type Campaign = {
    title: string;
    order: string;
    contentId: Hex;
    type: Goal | "";
    specialCategories: SpecialCategory[];
    budget: {
        type: "daily" | "monthly" | "";
        maxEuroDaily: number;
    };
    territories: TCountryCode[];
    scheduled?: {
        dateStart: Date;
        dateEnd: Date;
    };
    rewards: {
        click: { from: number; to: number };
        registration: { from: number; to: number };
        purchase: { from: number; to: number };
    };
    promotedContents: ContentType[];
};

export type CampaignState =
    | {
          key: "draft";
      }
    | {
          key: "creationFailed";
      }
    | {
          key: "created";
          isActive: boolean;
          address: Address;
      };

export type CampaignWithState = Campaign & {
    state: CampaignState;
};

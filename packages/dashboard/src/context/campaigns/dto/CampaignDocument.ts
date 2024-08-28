import type { Campaign } from "@/types/Campaign";
import type { ObjectId } from "mongodb";
import type { Address, Hex } from "viem";

export type CampaignDocument =
    | FinalizedCampaignDocument
    | DraftCampaignDocument;

export type FinalizedCampaignDocument = Campaign & {
    _id?: ObjectId;
    // The creator of the campaign
    creator: Address;
    // The current state of the campaign
    state: Extract<CampaignState, { key: "creationFailed" | "created" }>;
};

export type DraftCampaignDocument = Partial<Campaign> & {
    _id?: ObjectId;
    // The creator of the campaign
    creator: Address;
    // The current state of the campaign
    state: Extract<CampaignState, { key: "draft" }>;
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
          txHash: Hex;
          address: Address;
      };

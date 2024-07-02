import type { Campaign } from "@/types/Campaign";
import type { ObjectId } from "mongodb";
import type { Address, Hex } from "viem";

export type CampaignDocument = Campaign & {
    _id?: ObjectId;
    // The creator of the campaign
    creator: Address;
    // The current state of the campaign
    state: CampaignState;
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
